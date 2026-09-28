/**
 * Opus Bay asset manifest. Every URL below points at a file that exists under public/opus-bay
 * (served site-absolute as /opus-bay/...). Generated with Higgsfield on 2026-09-25 (district) and 2026-09-26 (whole SF);
 * provenance and credits: public/opus-bay/README.md and src/opus-bay/ASSETS-LEDGER.md.
 *
 * `ASSETS` keeps the shape the UI and audio code already read: plain URL strings for portraits,
 * postcards and voice (one URL per id, picked for this device). The typed tables (KEY_ART, PORTRAITS,
 * POSTCARD_ART, VOICE_CLIPS, MODELS) carry every size / container for callers that want srcset or both codecs.
 */
import type { VoiceId } from '../audio/logic';
import type { CityStyle } from '../world/recipes/city';
import { mapPaperUrls } from './mapPaper';
import { muralUrls } from './murals';
import type { PostcardId } from './postcards';
import { W4_MODELS, type W4ModelId } from './sf/w4Models';
import { SF_VOICE_CLIPS } from './voiceLinesSf';

const BASE = '/opus-bay';

/** `"a.webp 600w, b.webp 1200w"` from [url, width] pairs. */
export const srcSet = (entries: readonly (readonly [url: string, width: number])[]): string =>
  entries.map(([url, w]) => `${url} ${w}w`).join(', ');

function isHiDpi(): boolean {
  try { return (window.devicePixelRatio || 1) > 1.25; } catch { return false; }
}

// ---------------------------------------------------------------------------
// Key art (title screen). Wide 16:9 keeps its top third empty for the title; tall 9:16 keeps its lower third empty.
// ---------------------------------------------------------------------------

export interface KeyArt {
  /** 1920x1080 WebP (16:9). */
  wide: string;
  /** 1080x1920 WebP (9:16), for portrait phones. */
  tall: string;
  /** Chinese alt text (primary audience). */
  alt: string;
  altEn: string;
  wideSrcSet: string;
  tallSrcSet: string;
}

const art = (name: string) => `${BASE}/art/${name}.webp`;

export const KEY_ART: KeyArt = {
  wide: art('key-wide-1920'),
  tall: art('key-tall-1080'),
  alt: '漂浮在奶油色桌面上的微缩湾区：渡轮大厦钟楼、棕榈树、复古有轨电车、码头和海湾大桥，远处山顶是科伊特塔。小海獭 BAYBAY 在广场上向新来的旅人挥手。',
  altEn: 'A miniature Bay Area diorama floating over a cream table: the Ferry Building clock tower, palms, a vintage streetcar, piers and the Bay Bridge, with Coit Tower on its hill. BAYBAY the sea otter waves hello to a newcomer on the plaza.',
  wideSrcSet: srcSet([[art('key-wide-1280'), 1280], [art('key-wide-1920'), 1920]]),
  tallSrcSet: srcSet([[art('key-tall-720'), 720], [art('key-tall-1080'), 1080]]),
};

export const keyArtAlt = (locale: string): string => (locale === 'en' ? KEY_ART.altEn : KEY_ART.alt);

// ---------------------------------------------------------------------------
// Portraits: 512x512 WebP on a flat #f3ecdf background with a soft contact shadow.
// ---------------------------------------------------------------------------

export const PORTRAIT_IDS = [
  'baybay-happy', 'baybay-thinking', 'baybay-excited', 'baybay-proud', 'newcomer-neutral',
  // residents (dialogue portraits by NPC id: npc-vendor, npc-fisher, npc-streetcar, npc-family, npc-jogger)
  'npc-vendor', 'npc-fisher', 'npc-streetcar', 'npc-family', 'npc-jogger',
  // whole-SF residents (2026-09-26; aliased below as npc-gripman, npc-baker, ...)
  'sf-npc-gripman', 'sf-npc-baker', 'sf-npc-muralist', 'sf-npc-gardener', 'sf-npc-ranger', 'sf-npc-record-store',
] as const;
export type PortraitId = (typeof PORTRAIT_IDS)[number];
export const PORTRAIT_SIZE = 512;

export const PORTRAITS = Object.fromEntries(
  PORTRAIT_IDS.map(id => [id, `${BASE}/portraits/${id}.webp`]),
) as Record<PortraitId, string>;

/**
 * Mood aliases resolved by ui/common.tsx `portraitSrc` (`<key>-<mood>`): the happy portrait is the waving
 * pose and the excited one is pointing, so `wave` and `point` reuse them. No other mood has its own file.
 */
const PORTRAIT_ALIASES: Record<string, PortraitId> = {
  baybay: 'baybay-happy',
  'baybay-wave': 'baybay-happy',
  'baybay-point': 'baybay-excited',
  newcomer: 'newcomer-neutral',
  player: 'newcomer-neutral',
  // whole-SF residents by NPC id: Powell/Hyde cable car gripman, North Beach sourdough baker, Balmy Alley muralist,
  // Golden Gate Park gardener, Presidio ranger, Haight record-store owner
  'npc-gripman': 'sf-npc-gripman',
  'npc-baker': 'sf-npc-baker',
  'npc-muralist': 'sf-npc-muralist',
  'npc-gardener': 'sf-npc-gardener',
  'npc-ranger': 'sf-npc-ranger',
  'npc-record-store': 'sf-npc-record-store',
};

// ---------------------------------------------------------------------------
// Postcards: 4:3 WebP illustrations, large 1200x900 and small 600x450. Ids match data/postcards.ts.
// ---------------------------------------------------------------------------

export const POSTCARD_ART_IDS = [
  'ferry-building-dawn', 'pier7-sunset', 'exploratorium', 'filbert-steps', 'coit-tower', 'bay-bridge-night', 'sea-lions', 'streetcar',
] as const satisfies readonly PostcardId[];
export type PostcardArtId = (typeof POSTCARD_ART_IDS)[number];

export interface PostcardArt {
  /** 1200x900 */
  large: string;
  /** 600x450 */
  small: string;
  srcSet: string;
}

const postcardUrl = (id: string, w: 600 | 1200) => `${BASE}/postcards/${id}-${w}.webp`;

/**
 * Whole-SF postcards (2026-09-26, nano_banana_pro, ASSETS-LEDGER.md "Whole-SF assets, part 1"). They have no
 * data/postcards.ts entry yet: whoever adds the cards (title, anchor, fact) uses these ids, and then `POSTCARD_ART[id]`
 * and `ASSETS.postcards[id]` resolve like the district ones.
 */
export const SF_POSTCARD_ART_IDS = [
  'sf-golden-gate-fog', 'sf-painted-ladies', 'sf-palace-fine-arts', 'sf-cable-car-hill', 'sf-chinatown-lanterns',
  'sf-lombard-street', 'sf-mission-murals', 'sf-dolores-park', 'sf-windmill', 'sf-city-hall', 'sf-twin-peaks-view',
  'sf-ocean-beach',
] as const;
export type SfPostcardArtId = (typeof SF_POSTCARD_ART_IDS)[number];

/** What each SF illustration shows (working captions; the card copy belongs to the content/flow lanes). */
export const SF_POSTCARD_SUBJECTS: Record<SfPostcardArtId, { zh: string; en: string }> = {
  'sf-golden-gate-fog': { zh: '雾中的金门大桥', en: 'Golden Gate Bridge in the fog' },
  'sf-painted-ladies': { zh: '阿拉莫广场的彩绘女士', en: 'The Painted Ladies at Alamo Square' },
  'sf-palace-fine-arts': { zh: '艺术宫与天鹅湖', en: 'Palace of Fine Arts and its lagoon' },
  'sf-cable-car-hill': { zh: '爬坡的叮当车', en: 'A cable car climbing the hill' },
  'sf-chinatown-lanterns': { zh: '唐人街的红灯笼', en: 'Lanterns over Chinatown' },
  'sf-lombard-street': { zh: '九曲花街', en: 'Lombard Street’s crooked block' },
  'sf-mission-murals': { zh: '教会区壁画小巷', en: 'A Mission mural alley' },
  'sf-dolores-park': { zh: '多洛雷斯公园的午后', en: 'An afternoon in Dolores Park' },
  'sf-windmill': { zh: '金门公园的荷兰风车', en: 'The Dutch windmill in Golden Gate Park' },
  'sf-city-hall': { zh: '市政厅', en: 'City Hall' },
  'sf-twin-peaks-view': { zh: '双峰看全城', en: 'The city from Twin Peaks' },
  'sf-ocean-beach': { zh: '海洋海滩的日落', en: 'Sunset at Ocean Beach' },
};

export const POSTCARD_ART = Object.fromEntries(
  [...POSTCARD_ART_IDS, ...SF_POSTCARD_ART_IDS].map(id => [id, {
    large: postcardUrl(id, 1200),
    small: postcardUrl(id, 600),
    srcSet: srcSet([[postcardUrl(id, 600), 600], [postcardUrl(id, 1200), 1200]]),
  }]),
) as Record<PostcardArtId | SfPostcardArtId, PostcardArt>;

export const POSTCARD_SIZE = { large: { w: 1200, h: 900 }, small: { w: 600, h: 450 } } as const;

// ---------------------------------------------------------------------------
// Voice barks: BAYBAY (qwen_audio_tts preset "Pixie"), trimmed, -18 LUFS, mono.
// Each clip ships as AAC 64 kbps .m4a and Opus 48 kbps .ogg.
// ---------------------------------------------------------------------------

export interface VoiceClip {
  m4a: string;
  ogg: string;
  lang: 'zh' | 'en';
  text: string;
  /** seconds */
  duration: number;
}

const clip = (id: string, text: string, duration: number): VoiceClip => ({
  m4a: `${BASE}/voice/${id}.m4a`,
  ogg: `${BASE}/voice/${id}.ogg`,
  lang: id.startsWith('en-') ? 'en' : 'zh',
  text,
  duration,
});

export const VOICE_CLIPS: Record<VoiceId, VoiceClip> = {
  'zh-hi': clip('zh-hi', '嗨！', 0.47),
  'zh-this-way': clip('zh-this-way', '这边这边！', 1.18),
  'zh-wow': clip('zh-wow', '哇～', 0.99),
  'zh-yay': clip('zh-yay', '好耶！', 1.15),
  'zh-arrived': clip('zh-arrived', '到啦！', 0.96),
  'zh-think': clip('zh-think', '嗯…让我想想', 1.17),
  'en-hi': clip('en-hi', 'Hi there!', 0.77),
  'en-this-way': clip('en-this-way', 'This way!', 1.07),
  'en-yay': clip('en-yay', 'Yay!', 0.93),
  'en-arrived': clip('en-arrived', "We're here!", 0.98),
};

/** AAC where the browser can decode it (Safari, Chrome, Edge, most Firefox), otherwise Ogg Opus. */
export function preferredVoiceFormat(): 'm4a' | 'ogg' {
  try {
    const probe = document.createElement('audio');
    if (probe.canPlayType('audio/mp4; codecs="mp4a.40.2"')) return 'm4a';
    if (probe.canPlayType('audio/ogg; codecs="opus"')) return 'ogg';
  } catch { /* no DOM (tests, prerender) */ }
  return 'm4a';
}

// ---------------------------------------------------------------------------
// 3D models: single-mesh GLB, one matte material, 512 px JPEG base colour, no Draco.
// Origin at bottom centre (rests on y = 0), front faces +Z. size = [width x, height y, length z] in world units.
// ---------------------------------------------------------------------------

export interface ModelAsset {
  url: string;
  scale: number;
  /** Added to y after placing; the sailboat sinks its keel so the waterline sits a third up the hull. */
  yOffset: number;
  triangles: number;
  bytes: number;
  size: readonly [w: number, h: number, l: number];
}

/**
 * The district heroes (HC-4, lane D2, wave 3): packed by docs/opus-bay/kit-jobs/hero_glb_pack.py for the bare
 * GLTFLoader that actors/system.ts and world/life.ts use — normals int8, UVs uint16 (KHR_mesh_quantization), BAYBAY's
 * skin weights uint8 and animation rotations int16, WebP base colours (EXT_texture_webp); positions stay float (life.ts
 * bakes the node matrix into the geometry). 1,361,088 → 908,300 B. Draco needs a DRACOLoader in those two loaders first
 * (world/models.ts `heroGltfLoader()`; requested in docs/opus-bay/sf-w3-D2.md).
 */
export const MODEL_IDS = ['sea-lion', 'sea-lion-bark', 'pelican', 'sailboat', 'baybay'] as const;
export type ModelId = (typeof MODEL_IDS)[number];

const glb = (id: ModelId) => `${BASE}/models/${id}.glb`;

export const MODELS: Record<ModelId, ModelAsset> = {
  /** Lying on its belly; warm caramel clay. */
  'sea-lion': { url: glb('sea-lion'), scale: 1, yOffset: 0, triangles: 2909, bytes: 122_368, size: [1.18, 0.75, 1.6] },
  /** Head raised, barking; same animal as `sea-lion`, swaps 1:1. */
  'sea-lion-bark': { url: glb('sea-lion-bark'), scale: 1, yOffset: 0, triangles: 2907, bytes: 130_108, size: [0.79, 1.05, 1.16] },
  /** Standing; for gliding, tilt this mesh. */
  pelican: { url: glb('pelican'), scale: 1, yOffset: 0, triangles: 2909, bytes: 160_248, size: [0.49, 1.0, 0.76] },
  /** Keel 0-0.5, hull 0.5-1.45, mast top 4.96. */
  sailboat: { url: glb('sailboat'), scale: 1, yOffset: -0.75, triangles: 1939, bytes: 127_060, size: [1.05, 4.96, 4.0] },
  /**
   * BAYBAY, rigged (Blender 5.2): one SkinnedMesh, bones root / body / head / armL / armR / scarf / tail / footL / footR
   * (the procedural rig's names, identity rest rotations), 512 px base colour. Loaded by actors/ after Start.
   */
  baybay: { url: glb('baybay'), scale: 1, yOffset: 0, triangles: 8326, bytes: 368_516, size: [0.85, 1.3, 0.79] },
};

// ---------------------------------------------------------------------------
// Whole-SF models (2026-09-26): SAM 3 3D meshes from nano_banana_pro concepts, Blender 5.2 cleanup (weld, flat base,
// planar dissolve + collapse, palette grade), same conventions as MODELS: one mesh, one matte material, origin at
// ground centre, front faces +Z, size in world units. Differences: Draco-compressed geometry (KHR_draco_mesh_compression)
// and a WebP base colour (EXT_texture_webp), so the loader needs a DRACOLoader:
//   const draco = new DRACOLoader(); draco.setDecoderPath(SF_DRACO_DECODER_PATH); gltfLoader.setDRACOLoader(draco);
// Optional `mask` (256 px lossless WebP, same UVs as the base colour; load it with flipY = false like the GLB's own map):
//   R = night glass (GTA_SZ stencil B-R >= 28 & G-R >= 18 on the raw texture), G = wall tint region (houses: the
//   sage #cfe0d0 walls, recolour to any of the pastel set #f2c9b1 #cfe0d0 #f4e2a8 #c9d6e8 #e8c6cf by luminance x tint).
// ---------------------------------------------------------------------------

/** Directory holding three's Draco decoder (draco_decoder.wasm + draco_wasm_wrapper.js, copied from three 0.186). */
export const SF_DRACO_DECODER_PATH = `${BASE}/models/sf/draco/`;

export interface SfModelAsset extends ModelAsset {
  draco: true;
  /** 256 px mask WebP (R night glass, G tint region), when the model has glass or tintable walls. */
  mask?: string;
  /** Which part `mask.g` marks for per-instance recolouring. */
  tint?: 'walls';
  /** 'house' = instanced near the player; 'hero' = one per landmark. */
  kind: 'house' | 'hero';
  /** Landmark registry id (world/sf/landmarks, data/sf/landmarks) this model belongs to. */
  landmarkId: string;
  /** Walk-through passage along z, centred on x = 0 (measured by ray casts): clear width and height in world units. */
  passage?: { width: number; clearHeight: number };
}

/**
 * The wave-2 / wave-3 models (lane D2's `opus-bay-sf-models` test walks this list with the kit: 13 + 11). The wave-4 AI
 * landmarks (lane V, data/sf/w4Models.ts: Cal Academy, St Ignatius, Holy Virgin, the Chinese Pavilion) are
 * `W4_MODEL_IDS`, registered in `SF_MODELS` / `ASSETS.models` below and checked file by file in `opus-bay-w4-assets`.
 */
export const SF_MODEL_IDS = [
  'sf-victorian-a', 'sf-victorian-b', 'sf-palace-rotunda', 'sf-dragon-gate', 'sf-conservatory',
  // wave 3 (D2-15): the eight part-2a SAM landmark meshes
  'sf-legion-of-honor', 'sf-ghirardelli-clock-tower', 'sf-fort-point', 'sf-mission-dolores', 'sf-castro-theatre',
  'sf-windmill-body', 'sf-grace-cathedral', 'sf-city-hall',
] as const;
export type SfModelId = (typeof SF_MODEL_IDS)[number] | W4ModelId;

const sfFile = (name: string) => `${BASE}/models/sf/${name}`;

export const SF_MODELS: Record<SfModelId, SfModelAsset> = {
  /** Queen Anne row house with a corner turret, gable and stoop; walls tint-masked. 512 px texture. */
  'sf-victorian-a': {
    url: sfFile('victorian-a.glb'), mask: sfFile('victorian-a-mask.webp'), tint: 'walls', draco: true, kind: 'house',
    landmarkId: 'painted-ladies', scale: 1, yOffset: 0, triangles: 2940, bytes: 67_900, size: [4.23, 5.6, 3.94],
  },
  /** Italianate row house: flat false-front cornice, two-storey angled bay, stoop; walls tint-masked. 512 px texture. */
  'sf-victorian-b': {
    url: sfFile('victorian-b.glb'), mask: sfFile('victorian-b-mask.webp'), tint: 'walls', draco: true, kind: 'house',
    landmarkId: 'painted-ladies', scale: 1, yOffset: 0, triangles: 2940, bytes: 50_060, size: [3.81, 5.0, 4.19],
  },
  /**
   * Palace of Fine Arts rotunda only (colonnade and lagoon stay procedural): 8 arched piers, salmon dome, open
   * underneath (walk-in arches 2.45 u wide x 3.27 u clear). 1024 px texture.
   */
  'sf-palace-rotunda': {
    url: sfFile('palace-rotunda.glb'), draco: true, kind: 'hero', landmarkId: 'palace-of-fine-arts',
    passage: { width: 2.45, clearHeight: 3.27 }, scale: 1, yOffset: 0, triangles: 5874, bytes: 121_208, size: [12.66, 10.8, 12.67],
  },
  /**
   * Chinatown Dragon Gate: three jade roofs, blank plaque, no lions. Widened 1.2x in x so the central arch clears
   * 2.24 u x 2.57 u (side arches about 1.0 u x 2.0 u). 1024 px texture.
   */
  'sf-dragon-gate': {
    url: sfFile('dragon-gate.glb'), draco: true, kind: 'hero', landmarkId: 'dragon-gate',
    passage: { width: 2.24, clearHeight: 2.57 }, scale: 1, yOffset: 0, triangles: 5880, bytes: 124_200, size: [9.6, 5.85, 2.45],
  },
  /** Conservatory of Flowers: central dome, two glass wings, end pavilions; glass night-masked. 1024 px texture. */
  'sf-conservatory': {
    url: sfFile('conservatory.glb'), mask: sfFile('conservatory-mask.webp'), draco: true, kind: 'hero',
    landmarkId: 'conservatory-of-flowers', scale: 1, yOffset: 0, triangles: 5879, bytes: 125_224, size: [11.77, 6.0, 6.13],
  },
  // ---- wave 3 (lane D2, D2-15): the part-2a SAM 3 meshes (ledger LM1-3D…LM8-3D), cleaned with
  // docs/opus-bay/kit-jobs/kit_cleanup.py --grader hero (Blender 5.2) and graded to the DESIGN palette. 1024 px texture,
  // no mask (they are floodlit at night through the swap part's `glow`). The landmark modules scale them per axis.
  /**
   * Legion of Honor: museum block with the sage dome, the two colonnade wings and the front screen round the Court of
   * Honor. The court was stretched in depth (--box, middle band) and the gateway widened to 1.6 u (--gate).
   */
  'sf-legion-of-honor': {
    url: sfFile('legion-of-honor.glb'), draco: true, kind: 'hero', landmarkId: 'legion-of-honor',
    passage: { width: 1.6, clearHeight: 2.0 }, scale: 1, yOffset: 0, triangles: 5880, bytes: 120_288, size: [8.8, 5.0, 11.6],
  },
  /** Ghirardelli clock tower: a three-storey red-brick block with the clock tower and slate spire on one corner. */
  'sf-ghirardelli-clock-tower': {
    url: sfFile('ghirardelli-clock-tower.glb'), draco: true, kind: 'hero', landmarkId: 'ghirardelli-square',
    scale: 1, yOffset: 0, triangles: 5879, bytes: 133_520, size: [4.77, 8.0, 4.89],
  },
  /** Fort Point: the brick casemate fort, three tiers of gun ports, open parade ground, the little lighthouse. */
  'sf-fort-point': {
    url: sfFile('fort-point.glb'), draco: true, kind: 'hero', landmarkId: 'fort-point',
    scale: 1, yOffset: 0, triangles: 5879, bytes: 162_588, size: [11.98, 5.34, 10.2],
  },
  /**
   * Mission Dolores: the white adobe mission (tile roof, bell niches) beside the cream basilica with its two towers. The
   * basilica's butter yellow read as ochre in the city at golden hour: re-graded toward cream in place
   * (docs/opus-bay/kit-jobs/regrade_glb.py, hue 30–70°, saturation × 0.55; palette ΔE ≤ 12 on 94 % → 98 % of texels).
   */
  'sf-mission-dolores': {
    url: sfFile('mission-dolores.glb'), draco: true, kind: 'hero', landmarkId: 'mission-dolores',
    scale: 1, yOffset: 0, triangles: 5880, bytes: 98_936, size: [6.5, 4.55, 4.36],
  },
  /** Castro Theatre: the baroque facade, blank blade sign and V marquee, the long auditorium behind. No lettering. */
  'sf-castro-theatre': {
    url: sfFile('castro-theatre.glb'), draco: true, kind: 'hero', landmarkId: 'castro-theatre',
    scale: 1, yOffset: 0, triangles: 5880, bytes: 87_048, size: [4.3, 4.36, 5.67],
  },
  /** Dutch windmill body: plinth, tapering octagonal tower, reefing stage, cap with the windshaft stub (sails procedural). */
  'sf-windmill-body': {
    url: sfFile('windmill-body.glb'), draco: true, kind: 'hero', landmarkId: 'dutch-windmill',
    scale: 1, yOffset: 0, triangles: 5880, bytes: 91_692, size: [3.8, 6.5, 3.85],
  },
  /** Grace Cathedral: twin west towers, rose window, buttressed nave, transept, sage roofs and the crossing flèche. */
  'sf-grace-cathedral': {
    url: sfFile('grace-cathedral.glb'), draco: true, kind: 'hero', landmarkId: 'grace-cathedral',
    scale: 1, yOffset: 0, triangles: 5880, bytes: 118_076, size: [8.42, 9.57, 13.0],
  },
  /** City Hall: the Beaux-Arts block with porticos and corner pavilions, colonnaded drum, sage dome with gold trim. */
  'sf-city-hall': {
    url: sfFile('city-hall.glb'), draco: true, kind: 'hero', landmarkId: 'city-hall',
    scale: 1, yOffset: 0, triangles: 6860, bytes: 151_068, size: [17.7, 14.24, 11.29],
  },
  // ---- wave 4 (lane V, W4-V4 / W4-V4b): the four AI landmarks of lane L's sites (landmarkId = the site holding the slot)
  ...W4_MODELS,
};

// ---------------------------------------------------------------------------
// SF house kit (part 2a, 2026-09-26; registered on wave-2 day 0): 11 SAM 3 houses for the near-player kit swap (lane D2,
// world/sf/kitSwap.ts). Same conventions as SF_MODELS (Draco + WebP, origin at the ground centre, front faces +Z, size
// in world units = the ledger part 2a table). `mask` G marks the walls: recolour by luminance x tint (the building's L0
// wall colour); R = night glass. `tintKey` = the graded key colour the walls were remapped to (kit-jobs/specs.json).
// `styles` = the city recipe styles the house may stand in for (lane D2 refines the matching: corner, shop, zones).
// ---------------------------------------------------------------------------

export const SF_KIT_IDS = [
  'edwardian-flats', 'stick-victorian', 'queen-anne-corner', 'sunset-doelger', 'marina-mediterranean', 'richmond-flats',
  'chinatown-shophouse', 'northbeach-corner', 'soma-warehouse', 'mission-mural', 'deco-apartment',
] as const;
export type SfKitId = (typeof SF_KIT_IDS)[number];

export interface SfKitAsset extends ModelAsset {
  draco: true;
  kind: 'house';
  mask: string;
  tint: 'walls';
  /** graded wall key colour (null: the walls were not remapped, tint by luminance only) */
  tintKey: string | null;
  styles: readonly CityStyle[];
  /** a corner house (turret / wrap-around awning) */
  corner?: boolean;
  /** has a shop front at street level */
  shop?: boolean;
}

const kitFile = (id: SfKitId, ext: 'glb' | 'mask.webp') => `${BASE}/models/sf/kit/${id}${ext === 'glb' ? '.glb' : '-mask.webp'}`;
const kit = (id: SfKitId, triangles: number, bytes: number, size: readonly [number, number, number], tintKey: string | null, styles: readonly CityStyle[], extra: Partial<Pick<SfKitAsset, 'corner' | 'shop'>> = {}): SfKitAsset => ({
  url: kitFile(id, 'glb'), mask: kitFile(id, 'mask.webp'), tint: 'walls', draco: true, kind: 'house', scale: 1, yOffset: 0,
  triangles, bytes, size, tintKey, styles, ...extra,
});

export const SF_KIT: Record<SfKitId, SfKitAsset> = {
  'edwardian-flats': kit('edwardian-flats', 2890, 44_448, [4.4, 5.2, 8.0], '#c9d6e8', ['edwardian']),
  'stick-victorian': kit('stick-victorian', 2889, 42_904, [4.4, 5.4, 8.0], '#d9c8e6', ['victorian']),
  'queen-anne-corner': kit('queen-anne-corner', 2891, 68_232, [5.2, 6.4, 7.0], '#e8c6cf', ['victorian'], { corner: true }),
  'sunset-doelger': kit('sunset-doelger', 2890, 37_956, [4.4, 4.0, 8.0], '#cfe0d0', ['sunset']),
  'marina-mediterranean': kit('marina-mediterranean', 2890, 42_464, [4.4, 4.2, 8.0], '#f2c9b1', ['marina']),
  'richmond-flats': kit('richmond-flats', 2891, 68_972, [4.4, 5.4, 8.0], '#f4e2a8', ['edwardian']),
  'chinatown-shophouse': kit('chinatown-shophouse', 2890, 55_044, [4.4, 5.4, 8.0], '#ece2cf', ['chinatown'], { shop: true }),
  'northbeach-corner': kit('northbeach-corner', 2890, 65_912, [4.4, 5.2, 5.9], '#f0d49a', ['residential'], { corner: true, shop: true }),
  'soma-warehouse': kit('soma-warehouse', 2887, 65_732, [6.6, 5.6, 8.0], '#b56e55', ['brick', 'industrial']),
  'mission-mural': kit('mission-mural', 2890, 64_576, [4.4, 4.3, 8.0], null, ['residential'], { shop: true }),
  'deco-apartment': kit('deco-apartment', 2890, 57_940, [6.6, 8.2, 8.0], null, ['deco']),
};

// ---------------------------------------------------------------------------
// Neighbourhood badges (2026-09-26): 256x256 WebP with alpha (round clay badge, transparent corners), cut from two
// nano_banana_pro 3x3 sheets. Ids are neighbourhood slugs; `symbol` says what the badge shows.
// ---------------------------------------------------------------------------

export const BADGE_IDS = [
  'nob-hill', 'chinatown', 'alamo-square', 'golden-gate-park', 'presidio', 'mission', 'castro', 'north-beach', 'twin-peaks',
  'embarcadero', 'fishermans-wharf', 'marina', 'financial-district', 'civic-center', 'japantown', 'russian-hill', 'sunset', 'soma',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];
export const BADGE_SIZE = 256;

export interface Badge {
  url: string;
  name: { zh: string; en: string };
  symbol: string;
}

const badge = (id: BadgeId, zh: string, en: string, symbol: string): Badge => ({ url: `${BASE}/badges/${id}.webp`, name: { zh, en }, symbol });

export const BADGES: Record<BadgeId, Badge> = {
  'nob-hill': badge('nob-hill', '诺布山', 'Nob Hill', 'cable car'),
  chinatown: badge('chinatown', '唐人街', 'Chinatown', 'Dragon Gate'),
  'alamo-square': badge('alamo-square', '阿拉莫广场', 'Alamo Square', 'Victorian house with a turret'),
  'golden-gate-park': badge('golden-gate-park', '金门公园', 'Golden Gate Park', 'Dutch windmill'),
  presidio: badge('presidio', '要塞公园', 'Presidio', 'Golden Gate Bridge tower'),
  mission: badge('mission', '教会区', 'Mission', 'mural sun with marigolds'),
  castro: badge('castro', '卡斯特罗', 'Castro', 'rainbow flag'),
  'north-beach': badge('north-beach', '北滩', 'North Beach', 'Coit Tower on Telegraph Hill'),
  'twin-peaks': badge('twin-peaks', '双峰', 'Twin Peaks', 'two hills with the radio mast'),
  embarcadero: badge('embarcadero', '内河码头', 'Embarcadero', 'Ferry Building clock tower'),
  'fishermans-wharf': badge('fishermans-wharf', '渔人码头', 'Fisherman’s Wharf', 'sea lion on a dock'),
  marina: badge('marina', '马里纳区', 'Marina', 'Palace of Fine Arts rotunda'),
  'financial-district': badge('financial-district', '金融区', 'Financial District', 'pyramid tower'),
  'civic-center': badge('civic-center', '市政中心', 'Civic Center', 'City Hall dome'),
  japantown: badge('japantown', '日本城', 'Japantown', 'five-tier pagoda'),
  'russian-hill': badge('russian-hill', '俄罗斯山', 'Russian Hill', 'crooked Lombard Street'),
  sunset: badge('sunset', '日落区', 'Sunset', 'ocean wave at sunset'),
  soma: badge('soma', '南市场', 'SoMa', 'baseball and glove'),
};

// ---------------------------------------------------------------------------
// Manifest read by the UI / audio code
// ---------------------------------------------------------------------------

export interface AssetManifest {
  keyArt: KeyArt | null;
  /** id (and `<key>-<mood>` alias) -> 512 px portrait URL */
  portraits: Record<string, string>;
  /** postcard id -> illustration URL (1200 px on high-DPI screens, 600 px otherwise) */
  postcards: Record<string, string>;
  /** voice id -> clip URL in the container this browser decodes */
  voice: Record<string, string>;
  models: Record<string, ModelAsset>;
}

const hiDpi = isHiDpi();
const voiceFormat = preferredVoiceFormat();

export const ASSETS: AssetManifest = {
  keyArt: KEY_ART,
  portraits: {
    ...PORTRAITS,
    ...Object.fromEntries(Object.entries(PORTRAIT_ALIASES).map(([alias, id]) => [alias, PORTRAITS[id]])),
  },
  postcards: Object.fromEntries(
    [...POSTCARD_ART_IDS, ...SF_POSTCARD_ART_IDS].map(id => [id, hiDpi ? POSTCARD_ART[id].large : POSTCARD_ART[id].small]),
  ),
  // (lane H2b's city lines and re-records merge in from data/voiceLinesSf.ts; the player only plays listed ids)
  voice: Object.fromEntries(Object.entries({ ...VOICE_CLIPS, ...SF_VOICE_CLIPS }).map(([id, c]) => [id, c[voiceFormat]])),
  models: { ...MODELS, ...SF_MODELS, ...SF_KIT },
};

/**
 * Lazily loaded voice tables add their clips to `ASSETS.voice` (audio/voice.ts plays listed ids only): lane V's tour
 * narration (data/sf/voiceTour.ts, 214 clips ≈ 10 KB gzip of table) registers itself when the tour / audio code imports
 * it, so the table stays out of the main chunk. `skip` = ids left unregistered (the takes that await the owner's ear:
 * they play the chirp, like MUTED_CLIPS). An id already in the manifest is kept. Returns how many were added.
 */
export function registerVoiceClips(clips: Readonly<Record<string, VoiceClip>>, skip: readonly string[] = []): number {
  let added = 0;
  for (const [id, c] of Object.entries(clips)) {
    if (skip.includes(id) || ASSETS.voice[id]) continue;
    ASSETS.voice[id] = c[voiceFormat];
    added++;
  }
  return added;
}

/** Every distinct file URL in the manifest (for preloading or an existence check in tests). */
export function listAssetUrls(): string[] {
  const urls = new Set<string>([
    ...[KEY_ART.wideSrcSet, KEY_ART.tallSrcSet].flatMap(set => set.split(', ').map(entry => entry.split(' ')[0])),
    ...Object.values(PORTRAITS),
    ...Object.values(POSTCARD_ART).flatMap(p => [p.large, p.small]),
    ...Object.values(VOICE_CLIPS).flatMap(c => [c.m4a, c.ogg]),
    ...Object.values(SF_VOICE_CLIPS).flatMap(c => [c.m4a, c.ogg]),
    ...Object.values(MODELS).map(m => m.url),
    ...Object.values(SF_MODELS).flatMap(m => (m.mask ? [m.url, m.mask] : [m.url])),
    ...Object.values(SF_KIT).flatMap(m => [m.url, m.mask]),
    // lane H2b's painted map and murals (their own modules; empty until the assets land)
    ...mapPaperUrls(),
    ...muralUrls(),
    `${SF_DRACO_DECODER_PATH}draco_decoder.wasm`, `${SF_DRACO_DECODER_PATH}draco_wasm_wrapper.js`,
    ...Object.values(BADGES).map(b => b.url),
  ]);
  return [...urls];
}
