// Keep this module dependency-free: the public post server also imports it in native Node ESM.
let translateText = (text: string): string => text;
let metadataLocale = 'zh_CN';
let translateStructuredData = (data: Record<string, unknown>[]): Record<string, unknown>[] => data;
export const configureMetadataLanguage = (locale: string, translate: (text: string) => string, translateData: typeof translateStructuredData): void => {
  metadataLocale = locale;
  translateText = translate;
  translateStructuredData = translateData;
  if (currentMetadata) setPageMetadata(currentMetadata);
};
export const SITE_URL = 'https://www.baylink.us';
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/brand/baylink-app-icon.png`;
export const SITE_STRUCTURED_DATA: Record<string, unknown>[] = [
  { '@context': 'https://schema.org', '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'BAYLINK', alternateName: 'Baylink', url: SITE_URL + '/', logo: DEFAULT_SOCIAL_IMAGE },
  { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'BAYLINK', alternateName: 'Baylink', url: SITE_URL + '/', publisher: { '@id': `${SITE_URL}/#organization` } },
];

/**
 * A pair of reviewed strings inside structured data (`localCopy(zh, en)`): English pages take `en` as written, the
 * Chinese pages take `zh` (zh-Hant through the usual conversion). Resolved before the dictionary pass, so a label the
 * editorial dictionary lacks (a breadcrumb, an author) is never left in Chinese on /en.
 */
export type LocalCopy = { '@localCopy': { zh: string; en: string } };
export const localCopy = (zh: string, en: string): LocalCopy => ({ '@localCopy': { zh, en } });

export type PageMetadata = {
  title: string;
  description: string;
  path: string;
  /** Reviewed English title / description / image text for /en, used as written (hub pages whose copy is not editorial data). */
  english?: { title?: string; description?: string; imageAlt?: string };
  /** A shorter <title> for search results when the full title is long (og:title keeps the full one; I18N-SEO-11). */
  shortTitle?: string;
  /** 'en': the short title shortens English titles only (offers and openings keep their whole Chinese titles; H46). */
  shortTitleScope?: 'en';
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  structuredData?: Record<string, unknown>[];
  /** User-authored or already translated copy must bypass the editorial dictionary. */
  preserveText?: boolean;
  /** Explicit request locale avoids sharing mutable language state between server requests. */
  locale?: 'zh_CN' | 'zh_TW' | 'en_US';
  /** Only the validated public outing identifier is retained on a share URL. */
  outingId?: string;
  /** User-written pages (UGC) are one language: no hreflang cluster claiming a translation (I18N-SEO-12). */
  languageAlternates?: false;
  /** Canonical URL path when it differs from `path` (a /en or /zh-Hant copy of a user post points at the original). */
  canonicalPath?: string;
};

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

export const absolutePageUrl = (path: string, locale = metadataLocale): string => {
  const localPath = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  const url = new URL(localPath, SITE_URL);
  if (url.origin !== SITE_URL) return `${SITE_URL}/`;
  url.search = '';
  url.hash = '';
  const prefix = locale === 'en_US' ? '/en' : locale === 'zh_TW' ? '/zh-Hant' : '';
  if (!/^\/(en|zh-Hant)(\/|$)/.test(url.pathname) && prefix) url.pathname = prefix + url.pathname;
  return url.href;
};

const languageAlternates = (path: string): [string, string][] => {
  const base = new URL(path.startsWith('/') && !path.startsWith('//') ? path : '/', SITE_URL).pathname.replace(/^\/(en|zh-Hant)(?=\/|$)/, '') || '/';
  return [['zh-Hans', SITE_URL + base], ['zh-Hant', `${SITE_URL}/zh-Hant${base}`], ['en', `${SITE_URL}/en${base}`], ['x-default', SITE_URL + base]];
};

export const safeSocialImage = (image?: string): string => {
  if (!image) return DEFAULT_SOCIAL_IMAGE;
  try {
    const url = new URL(image, SITE_URL);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : DEFAULT_SOCIAL_IMAGE;
  } catch { return DEFAULT_SOCIAL_IMAGE; }
};

const isEnglish = (metadata: PageMetadata) => (metadata.locale || metadataLocale) === 'en_US';
/** English titles separate the brand with an ASCII bar (" | BAYLINK"), not the full-width ｜ (I18N-SEO-08). */
const englishSeparators = (value: string) => value.replace(/\s*｜\s*/g, ' | ');
const localizedField = (metadata: PageMetadata, field: 'title' | 'description' | 'imageAlt'): string => {
  const english = isEnglish(metadata) ? metadata.english?.[field] ?? (field === 'imageAlt' && !metadata.imageAlt ? metadata.english?.title : undefined) : undefined;
  if (english) return english;
  const value = field === 'imageAlt' ? metadata.imageAlt || metadata.title : metadata[field];
  const text = metadata.preserveText ? value : translateText(value);
  // user-written text (preserveText) is left exactly as written
  return isEnglish(metadata) && field !== 'description' && !metadata.preserveText ? englishSeparators(text) : text;
};
/** CJK counts as one, Latin as half (the overlay's display units). */
const displayWidth = (value: string) => [...value].reduce((width, character) => width + (/[\u2e80-\uffff]/.test(character) ? 1 : 0.5), 0);
/** English <title>s fit a search result: at most 60 characters (H46, I13-09). */
export const ENGLISH_TITLE_LIMIT = 60;
const BRAND = ' | BAYLINK';
/** A cut before one of these words leaves a whole phrase ("Begin birdwatching at Alviso Marina" | "without …"). */
const PHRASE_BREAK = /^(?:with|without|for|on|in|at|after|before|from|during|near|via|while|that|which|when|until)$/i;
/** A cut before one of these leaves a list that goes on ("Free California Art, History" | "and …"): it keeps its "…". */
const LIST_GOES_ON = /^(?:and|or|&)$/i;
const TRAILING_MARKS = /[\s,;:·|–—&-]+$/u;
/**
 * The longest head of `text` within `limit`: before the last phrase break past the middle when there is one (whole, no
 * "…"; the full title stays in og:title and the H1), else before "and" / "or" with "…", else at a word with "…".
 */
const cutAtWord = (text: string, limit: number) => {
  const words = text.split(' ');
  let phrase = 0, list = 0;
  for (let index = 1, length = words[0].length; index < words.length && length <= limit - 1; length += words[index].length + 1, index++) {
    if (length < limit * 0.55) continue;
    if (PHRASE_BREAK.test(words[index])) phrase = index;
    else if (LIST_GOES_ON.test(words[index])) list = index;
  }
  if (phrase) return words.slice(0, phrase).join(' ').replace(TRAILING_MARKS, '');
  if (list) return `${words.slice(0, list).join(' ').replace(TRAILING_MARKS, '')}…`;
  const head = text.slice(0, limit - 1);
  const space = head.lastIndexOf(' ');
  return `${(space > limit / 2 ? head.slice(0, space) : head).replace(TRAILING_MARKS, '')}…`;
};
/** The name before its first break ("Alameda Point Antiques Faire: Vintage Finds…" → "Alameda Point Antiques Faire"). */
const titleHead = (name: string): string | undefined => {
  const breaks = [': ', ' — ', ' – ', ' · ', ' | ', '? '].map(mark => [name.indexOf(mark), mark] as const).filter(([index]) => index > 0).sort((a, b) => a[0] - b[0]);
  if (!breaks.length) return undefined;
  const [index, mark] = breaks[0];
  return name.slice(0, mark === '? ' ? index + 1 : index).trim();
};
/**
 * H46: an English title longer than 60 characters gives way to, in order: the reviewed short title + " | BAYLINK"; the
 * page name alone (without the brand) when that fits, or its first and last " · " parts; the name before its first break
 * + brand; the name cut at a word.
 * og:title, twitter:title and the H1 keep the full title.
 */
export function englishDocumentTitle(full: string, short?: string): string {
  if (full.length <= ENGLISH_TITLE_LIMIT) return full;
  const name = full.endsWith(BRAND) ? full.slice(0, -BRAND.length).trim() : full;
  const branded = (text: string) => /\bBAYLINK\b/.test(text) ? text : `${text}${BRAND}`;
  // a short title the dictionary cannot translate would put Chinese into an English <title>: it is skipped
  if (short && !/[㐀-鿿]/.test(short) && branded(short.trim()).length <= ENGLISH_TITLE_LIMIT) return branded(short.trim());
  if (name.length <= ENGLISH_TITLE_LIMIT) return name;
  // "AMC · Bay Area · Half-price tickets…": the brand and the offer, without the place between them
  const segments = name.split(' · ');
  const condensed = segments.length > 2 ? `${segments[0]} · ${segments[segments.length - 1]}` : name;
  if (condensed.length <= ENGLISH_TITLE_LIMIT) return condensed;
  // the listing's own part before its break ("Brand · Restaurant Week: Special Menus…" → "Restaurant Week"), then the name's
  const lastHead = segments.length > 1 ? titleHead(segments[segments.length - 1]) : undefined;
  for (const head of [lastHead, titleHead(name)]) if (head && head.length >= 8 && branded(head).length <= ENGLISH_TITLE_LIMIT) return branded(head);
  const head = titleHead(name);
  if (head && head.length >= 8 && head.length <= ENGLISH_TITLE_LIMIT) return head;
  return branded(cutAtWord(condensed, ENGLISH_TITLE_LIMIT - BRAND.length));
}
/** The search-result title: the full title when it fits, else the reviewed short title (+ brand). */
const documentTitle = (metadata: PageMetadata): string => {
  const full = localizedField(metadata, 'title');
  const short = metadata.shortTitle && (metadata.preserveText ? metadata.shortTitle : translateText(metadata.shortTitle));
  if (isEnglish(metadata)) return englishDocumentTitle(full, short);
  // only a title well past what a result shows (~30 CJK) gives way: the full one carries the place and the name
  if (!short || metadata.shortTitleScope === 'en' || displayWidth(full) <= 38) return full;
  return `${short}｜BAYLINK`;
};
/** Search snippets: at most ~155 Latin / ~90 CJK characters, cut at a sentence or word boundary (I18N-SEO-11). */
export const snippet = (value: string, english: boolean): string => {
  const limit = english ? 155 : 90;
  const text = value.replace(/\s+/g, ' ').trim();
  const characters = [...text];
  if (characters.length <= limit) return text;
  const head = characters.slice(0, limit).join('');
  const boundary = Math.max(...(english ? ['. ', '; ', ', ', ' '] : ['。', '；', '，', '、', ' ']).map(mark => head.lastIndexOf(mark)));
  return `${(boundary > head.length * 0.6 ? head.slice(0, boundary) : head).replace(/[\s,;:，；：、·｜|-]+$/u, '')}…`;
};
/** Share cards (per item and per hub) are 1200 × 630 PNGs in every language (scripts/generate-share-cards.ts). */
const SHARE_CARD = /^\/share-cards\//;
const imagePath = (image: string) => { try { const url = new URL(image, SITE_URL); return url.origin === SITE_URL ? url.pathname : ''; } catch { return ''; } };
/** A share card's language edition: /share-cards/en/…, /share-cards/zh-Hant/… (zh-Hans keeps the original path). */
export const localizedSocialImage = (image: string, locale = metadataLocale): string => {
  const path = imagePath(image);
  if (!SHARE_CARD.test(path) || /^\/share-cards\/(?:en|zh-Hant)\//.test(path) || locale === 'zh_CN') return image;
  return `${SITE_URL}/share-cards/${locale === 'en_US' ? 'en' : 'zh-Hant'}/${path.slice('/share-cards/'.length)}`;
};
const imageSize = (image: string): [number, number] | undefined => {
  if (image === DEFAULT_SOCIAL_IMAGE) return [512, 512];
  return SHARE_CARD.test(imagePath(image)) ? [1200, 630] : undefined;
};
const IMAGE_SIZE_KEY = /^og:image:(?:width|height|type)$/;

const metadataEntries = (metadata: PageMetadata): [string, string, string][] => {
  const locale = metadata.locale || metadataLocale;
  const image = localizedSocialImage(safeSocialImage(metadata.image), locale);
  const english = isEnglish(metadata);
  const title = localizedField(metadata, 'title');
  const description = localizedField(metadata, 'description');
  const size = imageSize(image);
  const sizeEntries: [string, string, string][] = size ? [['property', 'og:image:width', String(size[0])], ['property', 'og:image:height', String(size[1])], ['property', 'og:image:type', 'image/png']] : [];
  return [
    ['name', 'description', snippet(description, english)],
    ['name', 'robots', metadata.noindex ? 'noindex, follow' : 'index, follow'],
    ['property', 'og:type', metadata.type || 'website'],
    ['property', 'og:site_name', 'BAYLINK'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', metadataUrl(metadata)],
    ['property', 'og:image', image],
    ...sizeEntries,
    ['property', 'og:image:alt', localizedField(metadata, 'imageAlt')],
    ['property', 'og:locale', locale],
    ['name', 'twitter:card', image === DEFAULT_SOCIAL_IMAGE ? 'summary' : 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', snippet(description, english)],
    ['name', 'twitter:image', image],
  ];
};

const metadataUrl = (metadata: PageMetadata): string => {
  const url = new URL(metadata.canonicalPath ? absolutePageUrl(metadata.canonicalPath, 'zh_CN') : absolutePageUrl(metadata.path, metadata.locale));
  if (metadata.outingId && /^[a-zA-Z0-9_-]{1,128}$/.test(metadata.outingId) && /\/together\/?$/.test(url.pathname)) url.searchParams.set('outing', metadata.outingId);
  return url.href;
};
/** Replaces each `localCopy` pair with the page language's string, and points share-card images at the page's language. */
const resolveCopies = (value: unknown, locale: string, key = ''): unknown => {
  if (typeof value === 'string') return key === 'image' ? localizedSocialImage(value, locale) : value;
  if (Array.isArray(value)) return value.map(item => resolveCopies(item, locale, key));
  if (!value || typeof value !== 'object') return value;
  const pair = (value as Partial<LocalCopy>)['@localCopy'];
  if (pair) return locale === 'en_US' ? pair.en : pair.zh;
  return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, resolveCopies(item, locale, name)]));
};
const metadataData = (metadata: PageMetadata): Record<string, unknown>[] => {
  const data = resolveCopies(metadata.structuredData || [], metadata.locale || metadataLocale) as Record<string, unknown>[];
  return metadata.preserveText ? data : translateStructuredData(data);
};
const hasAlternates = (metadata: PageMetadata) => !metadata.noindex && metadata.languageAlternates !== false;

/**
 * A user's post (UGC) is one text in its author's language (I18N-SEO-12): no hreflang cluster claiming translations, and
 * its /en and /zh-Hant copies (the same text with translated controls) canonical to the original and not indexed, so
 * search engines see one page per post. Applied here, so every caller gets it: the server page (api/post-page.ts), the
 * app's post route (AppLayout) and the post sheet (PostDetailModal), in whatever language the reader switches to.
 */
const USER_POST = /^\/(?:(?:en|zh-Hant)\/)?posts\/([^/]+)\/?$/;
const withPagePolicy = (metadata: PageMetadata): PageMetadata => {
  let pathname: string;
  try { pathname = new URL(metadata.path, SITE_URL).pathname; } catch { return metadata; }
  const post = USER_POST.exec(pathname);
  if (!post) return metadata;
  const copy = (metadata.locale || metadataLocale) !== 'zh_CN';
  return { ...metadata, languageAlternates: false, canonicalPath: `/posts/${post[1]}`, noindex: metadata.noindex || copy };
};

// JSON-LD is data, but HTML parsers still recognize a closing script tag inside strings.
export const serializeStructuredData = (data: Record<string, unknown>[]): string =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Used on client navigation. Importing this module is also safe during server rendering. */
let currentMetadata: PageMetadata | undefined;
export const setPageMetadata = (page: PageMetadata): void => {
  if (typeof document === 'undefined') return;
  // kept as given: a language switch re-applies it (configureMetadataLanguage), and the post policy depends on the language
  currentMetadata = page;
  const metadata = withPagePolicy(page);
  document.title = documentTitle(metadata);
  // Image size tags this module wrote for the previous page; other head tags (the game's own) are not ours to remove
  document.head.querySelectorAll('meta[data-baylink-image-size]').forEach(element => element.remove());
  for (const [attribute, key, value] of metadataEntries(metadata)) {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      if (IMAGE_SIZE_KEY.test(key)) element.dataset.baylinkImageSize = '';
      document.head.append(element);
    }
    element.content = value;
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = metadataUrl(metadata);
  document.head.querySelectorAll('link[data-baylink-language]').forEach(element => element.remove());
  if (hasAlternates(metadata)) for (const [locale, href] of languageAlternates(metadata.path)) {
    const link = document.createElement('link'); link.rel = 'alternate'; link.hreflang = locale; link.href = href;
    link.dataset.baylinkLanguage = ''; document.head.append(link);
  }
  // The page the server rendered keeps its JSON-LD while the app shows that same page: the prerender adds facts the
  // bundle does not carry (an article's first-published day). Any other page, or another language, replaces it.
  const prerendered = document.head.querySelector<HTMLScriptElement>('script[data-baylink-structured-data][data-baylink-prerendered]');
  if (prerendered && metadata.structuredData?.length && prerendered.dataset.url === metadataUrl(metadata)) return;
  document.head.querySelectorAll('script[data-baylink-structured-data]').forEach((element) => element.remove());
  if (metadata.structuredData?.length) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.baylinkStructuredData = '';
    script.textContent = serializeStructuredData(metadataData(metadata));
    document.head.append(script);
  }
};

export const renderMetadataHtml = (page: PageMetadata): string => {
  const metadata = withPagePolicy(page);
  return [
    `<title>${escapeHtml(documentTitle(metadata))}</title>`,
    `<link rel="canonical" href="${escapeHtml(metadataUrl(metadata))}" />`,
    ...(hasAlternates(metadata) ? languageAlternates(metadata.path).map(([locale, href]) => `<link rel="alternate" hreflang="${locale}" href="${escapeHtml(href)}" data-baylink-language />`) : []),
    ...metadataEntries(metadata).map(([attribute, key, value]) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}"${IMAGE_SIZE_KEY.test(key) ? ' data-baylink-image-size' : ''} />`),
    ...(metadata.structuredData?.length ? [`<script type="application/ld+json" data-baylink-structured-data data-baylink-prerendered data-url="${escapeHtml(metadataUrl(metadata))}">${serializeStructuredData(metadataData(metadata))}</script>`] : []),
  ].join('\n    ');
};

/** Marker replacement keeps the Vite asset references and avoids serializing user/API objects. */
export const renderHtmlDocument = (template: string, metadata: PageMetadata, body: string): string => {
  const metaPattern = /<!--baylink-meta-start-->[\s\S]*?<!--baylink-meta-end-->/;
  const bodyPattern = /<!--baylink-app-start-->[\s\S]*?<!--baylink-app-end-->/;
  if (!metaPattern.test(template) || !bodyPattern.test(template)) throw new Error('Built HTML is missing BAYLINK render markers');
  return template
    .replace(metaPattern, () => `<!--baylink-meta-start-->\n    ${renderMetadataHtml(metadata)}\n    <!--baylink-meta-end-->`)
    .replace(bodyPattern, () => `<!--baylink-app-start-->\n    <div id="root">${body}</div>\n    <!--baylink-app-end-->`);
};
