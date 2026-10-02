import { SITE_URL, type PageMetadata } from './seo';

/**
 * W9-E · /opus-bay's own page (review 2026-10-01 R§5 #3): its title, description, share image and language alternates, and
 * the key art its static first paint shows. Used by scripts/prerender.tsx (dist/opus-bay.html, and dist/play.html once
 * /play points at the game), by App.tsx (the same first paint while the game's route chunk loads) and by OpusBayPage
 * (the metadata in the chosen language). Dependency-free apart from seo.ts: the site's main bundle imports it.
 */
export const OPUS_BAY_PATH = '/opus-bay';

/** The game's own words for its page (OpusBayPage PageMeta, city mode): zh is what the static HTML carries. */
export const OPUS_BAY_COPY = {
  title: { zh: '湾区小旅 · 跟 BAYBAY 逛旧金山｜BAYLINK', en: 'Little Bay Trip · Explore San Francisco with BAYBAY | BAYLINK' },
  description: {
    zh: '跟 BAYBAY 逛整座旧金山：金门大桥、叮当车、双峰，真实景点和这周活动，一个可以边玩边查的迷你旧金山。',
    en: 'Roam all of San Francisco with BAYBAY — the Golden Gate, cable cars, Twin Peaks: real places and this week’s events in a mini San Francisco you can play.',
  },
} as const;

/** 1200 × 630 crops of the key art (public/opus-bay/og-*.jpg: the 1920 × 1080 art, rows 40–1048, scaled; W9-E). */
export const OPUS_BAY_OG = {
  key: '/opus-bay/og-key.jpg',
  halloween: '/opus-bay/og-halloween.jpg',
  width: 1200,
  height: 630,
  alt: { zh: '微缩旧金山：渡轮大厦钟楼、海湾大桥和科伊特塔，小海獭 BAYBAY 在广场上挥手。', en: 'A miniature San Francisco: the Ferry Building clock tower, the Bay Bridge and Coit Tower, with BAYBAY the sea otter waving on the plaza.' },
} as const;

/** The title's key art (the same files as src/opus-bay/data/assets.ts KEY_ART / KEY_ART_HALLOWEEN; a test keeps them equal). */
export const OPUS_BAY_ART = {
  key: {
    wide: '/opus-bay/art/key-wide-1920.webp',
    wideSrcSet: '/opus-bay/art/key-wide-1280.webp 1280w, /opus-bay/art/key-wide-1920.webp 1920w',
    tallSrcSet: '/opus-bay/art/key-tall-720.webp 720w, /opus-bay/art/key-tall-1080.webp 1080w',
  },
  halloween: {
    wide: '/opus-bay/w6/art/key-wide-halloween-1920.webp',
    wideSrcSet: '/opus-bay/w6/art/key-wide-halloween-1280.webp 1280w, /opus-bay/w6/art/key-wide-halloween-1920.webp 1920w',
    tallSrcSet: '/opus-bay/w6/art/key-tall-halloween-720.webp 720w, /opus-bay/w6/art/key-tall-halloween-1080.webp 1080w',
  },
} as const;

let monthFormat: Intl.DateTimeFormat | undefined;
/** The month (1–12) on the Bay's clock (America/Los_Angeles). */
export const bayMonth = (date: Date): number =>
  Number((monthFormat ??= new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric' })).format(date));

/**
 * Whether the title wears its Halloween dress — the rule of src/opus-bay/data/assets.ts titleInHalloween + keyArtFor,
 * restated here so the site's main bundle imports no game module: October on the Bay's clock, or `?halloween=1|season|night`
 * (`muertos` / `off` / `0` → no); district mode (`?world=district`) never. The static HTML knows only the build's date.
 */
export function opusBayInHalloween(date: Date = new Date(), search = ''): boolean {
  const q = new URLSearchParams(search);
  if (q.get('world')?.trim().toLowerCase() === 'district') return false;
  const v = q.get('halloween')?.trim().toLowerCase();
  if (v === '1' || v === 'season' || v === 'night') return true;
  if (v === 'muertos' || v === 'off' || v === '0') return false;
  return bayMonth(date) === 10;
}

/** The share image's absolute URL (the Halloween crop in October). */
export const opusBayOgImage = (date: Date = new Date()): string => `${SITE_URL}${opusBayInHalloween(date) ? OPUS_BAY_OG.halloween : OPUS_BAY_OG.key}`;

/** /opus-bay's metadata in one language (the static HTML: zh). */
export const opusBayMetadata = (date: Date = new Date(), lang: 'zh' | 'en' = 'zh'): PageMetadata => ({
  title: OPUS_BAY_COPY.title[lang],
  description: OPUS_BAY_COPY.description[lang],
  path: OPUS_BAY_PATH,
  image: opusBayOgImage(date),
  preserveText: true,
});

/** The language editions (the site's ?lang rule: Simplified carries no parameter). */
export const OPUS_BAY_ALTERNATES: readonly (readonly [hreflang: string, href: string])[] = [
  ['zh-Hans', `${SITE_URL}${OPUS_BAY_PATH}`],
  ['zh-Hant', `${SITE_URL}${OPUS_BAY_PATH}?lang=zh-Hant`],
  ['en', `${SITE_URL}${OPUS_BAY_PATH}?lang=en`],
  ['x-default', `${SITE_URL}${OPUS_BAY_PATH}`],
];

const attr = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Head tags seo.ts does not write: the hreflang alternates and the share image's size and alt text. */
export const opusBayHeadExtras = (): string => [
  ...OPUS_BAY_ALTERNATES.map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${attr(href)}" />`),
  `<meta property="og:image:width" content="${OPUS_BAY_OG.width}" />`,
  `<meta property="og:image:height" content="${OPUS_BAY_OG.height}" />`,
  `<meta property="og:image:alt" content="${attr(OPUS_BAY_OG.alt.zh)}" />`,
  `<meta property="og:locale:alternate" content="zh_TW" />`,
  `<meta property="og:locale:alternate" content="en_US" />`,
].join('\n    ');

/**
 * W9-E-switch · /play is now the 3D San Francisco game (the owner, 2026-10-01: "当OPUS-BAY没问题的时候，就可以替代PLAY了";
 * W9-Z's switch gate decides — reverting the W9-E-switch commits brings the old page back, LittleBayPage is kept unrouted).
 * `/play` → `/opus-bay?from=play`, keeping `?lang`; an old shared weekend ticket (`/play?date=&stops=&places=`, what
 * LittleBayPage's 分享车票 made) → the site's planner with the same plan (`/plan` reads date / stops / places:
 * lib/planner.ts parseSharedPlan), keeping `?lang`. Every other parameter of the old page (view=…) is dropped.
 */
export function playRedirectTarget(search: string): string {
  const q = new URLSearchParams(search);
  const out = new URLSearchParams();
  const ticket = ['date', 'stops', 'places'].filter(k => q.get(k));
  for (const k of ticket) out.set(k, q.get(k)!);
  const lang = q.get('lang');
  if (lang) out.set('lang', lang);
  if (ticket.length) return `/plan?${out.toString()}`;
  out.set('from', 'play');
  return `/opus-bay?${out.toString()}`;
}
