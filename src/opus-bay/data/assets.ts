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
import type { PostcardId } from './postcards';

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

export const MODEL_IDS = ['sea-lion', 'sea-lion-bark', 'pelican', 'sailboat', 'baybay'] as const;
export type ModelId = (typeof MODEL_IDS)[number];

const glb = (id: ModelId) => `${BASE}/models/${id}.glb`;

export const MODELS: Record<ModelId, ModelAsset> = {
  /** Lying on its belly; warm caramel clay. */
  'sea-lion': { url: glb('sea-lion'), scale: 1, yOffset: 0, triangles: 2909, bytes: 175_584, size: [1.18, 0.75, 1.6] },
  /** Head raised, barking; same animal as `sea-lion`, swaps 1:1. */
  'sea-lion-bark': { url: glb('sea-lion-bark'), scale: 1, yOffset: 0, triangles: 2907, bytes: 185_328, size: [0.79, 1.05, 1.16] },
  /** Standing; for gliding, tilt this mesh. */
  pelican: { url: glb('pelican'), scale: 1, yOffset: 0, triangles: 2909, bytes: 223_224, size: [0.49, 1.0, 0.76] },
  /** Keel 0-0.5, hull 0.5-1.45, mast top 4.96. */
  sailboat: { url: glb('sailboat'), scale: 1, yOffset: -0.75, triangles: 1939, bytes: 177_796, size: [1.05, 4.96, 4.0] },
  /**
   * BAYBAY, rigged (Blender 5.2): one SkinnedMesh, bones root / body / head / armL / armR / scarf / tail / footL / footR
   * (the procedural rig's names, identity rest rotations), 512 px JPEG base colour. Loaded by actors/ after Start.
   */
  baybay: { url: glb('baybay'), scale: 1, yOffset: 0, triangles: 8326, bytes: 599_156, size: [0.85, 1.3, 0.79] },
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
  /** sf-data landmarks.json id this model belongs to. */
  landmarkId: string;
  /** Walk-through passage along z, centred on x = 0 (measured by ray casts): clear width and height in world units. */
  passage?: { width: number; clearHeight: number };
}

export const SF_MODEL_IDS = ['sf-victorian-a', 'sf-victorian-b', 'sf-palace-rotunda', 'sf-dragon-gate', 'sf-conservatory'] as const;
export type SfModelId = (typeof SF_MODEL_IDS)[number];

const sfFile = (name: string) => `${BASE}/models/sf/${name}`;

export const SF_MODELS: Record<SfModelId, SfModelAsset> = {
  /** Queen Anne row house with a corner turret, gable and stoop; walls tint-masked. 512 px texture. */
  'sf-victorian-a': {
    url: sfFile('victorian-a.glb'), mask: sfFile('victorian-a-mask.webp'), tint: 'walls', draco: true, kind: 'house',
    landmarkId: 'alamo-square-painted-ladies', scale: 1, yOffset: 0, triangles: 2940, bytes: 67_900, size: [4.23, 5.6, 3.94],
  },
  /** Italianate row house: flat false-front cornice, two-storey angled bay, stoop; walls tint-masked. 512 px texture. */
  'sf-victorian-b': {
    url: sfFile('victorian-b.glb'), mask: sfFile('victorian-b-mask.webp'), tint: 'walls', draco: true, kind: 'house',
    landmarkId: 'alamo-square-painted-ladies', scale: 1, yOffset: 0, triangles: 2940, bytes: 50_060, size: [3.81, 5.0, 4.19],
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
    url: sfFile('dragon-gate.glb'), draco: true, kind: 'hero', landmarkId: 'chinatown-dragon-gate',
    passage: { width: 2.24, clearHeight: 2.57 }, scale: 1, yOffset: 0, triangles: 5880, bytes: 124_200, size: [9.6, 5.85, 2.45],
  },
  /** Conservatory of Flowers: central dome, two glass wings, end pavilions; glass night-masked. 1024 px texture. */
  'sf-conservatory': {
    url: sfFile('conservatory.glb'), mask: sfFile('conservatory-mask.webp'), draco: true, kind: 'hero',
    landmarkId: 'conservatory-of-flowers', scale: 1, yOffset: 0, triangles: 5879, bytes: 125_224, size: [11.77, 6.0, 6.13],
  },
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
  marina: badge('marina', '码头区', 'Marina', 'Palace of Fine Arts rotunda'),
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
  voice: Object.fromEntries(Object.entries(VOICE_CLIPS).map(([id, c]) => [id, c[voiceFormat]])),
  models: { ...MODELS, ...SF_MODELS },
};

/** Every distinct file URL in the manifest (for preloading or an existence check in tests). */
export function listAssetUrls(): string[] {
  const urls = new Set<string>([
    ...[KEY_ART.wideSrcSet, KEY_ART.tallSrcSet].flatMap(set => set.split(', ').map(entry => entry.split(' ')[0])),
    ...Object.values(PORTRAITS),
    ...Object.values(POSTCARD_ART).flatMap(p => [p.large, p.small]),
    ...Object.values(VOICE_CLIPS).flatMap(c => [c.m4a, c.ogg]),
    ...Object.values(MODELS).map(m => m.url),
    ...Object.values(SF_MODELS).flatMap(m => (m.mask ? [m.url, m.mask] : [m.url])),
    `${SF_DRACO_DECODER_PATH}draco_decoder.wasm`, `${SF_DRACO_DECODER_PATH}draco_wasm_wrapper.js`,
    ...Object.values(BADGES).map(b => b.url),
  ]);
  return [...urls];
}
