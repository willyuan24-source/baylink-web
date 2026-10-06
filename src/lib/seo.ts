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

export type PageMetadata = {
  title: string;
  description: string;
  path: string;
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

const metadataEntries = (metadata: PageMetadata): [string, string, string][] => {
  const image = safeSocialImage(metadata.image);
  const text = metadata.preserveText ? (value: string) => value : translateText;
  return [
    ['name', 'description', text(metadata.description)],
    ['name', 'robots', metadata.noindex ? 'noindex, follow' : 'index, follow'],
    ['property', 'og:type', metadata.type || 'website'],
    ['property', 'og:site_name', 'BAYLINK'],
    ['property', 'og:title', text(metadata.title)],
    ['property', 'og:description', text(metadata.description)],
    ['property', 'og:url', metadataUrl(metadata)],
    ['property', 'og:image', image],
    ['property', 'og:image:alt', text(metadata.imageAlt || metadata.title)],
    ['property', 'og:locale', metadata.locale || metadataLocale],
    ['name', 'twitter:card', image === DEFAULT_SOCIAL_IMAGE ? 'summary' : 'summary_large_image'],
    ['name', 'twitter:title', text(metadata.title)],
    ['name', 'twitter:description', text(metadata.description)],
    ['name', 'twitter:image', image],
  ];
};

const metadataUrl = (metadata: PageMetadata): string => {
  const url = new URL(absolutePageUrl(metadata.path, metadata.locale));
  if (metadata.outingId && /^[a-zA-Z0-9_-]{1,128}$/.test(metadata.outingId) && /\/together\/?$/.test(url.pathname)) url.searchParams.set('outing', metadata.outingId);
  return url.href;
};
const metadataData = (metadata: PageMetadata): Record<string, unknown>[] =>
  metadata.preserveText ? metadata.structuredData || [] : translateStructuredData(metadata.structuredData || []);

// JSON-LD is data, but HTML parsers still recognize a closing script tag inside strings.
export const serializeStructuredData = (data: Record<string, unknown>[]): string =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Used on client navigation. Importing this module is also safe during server rendering. */
let currentMetadata: PageMetadata | undefined;
export const setPageMetadata = (metadata: PageMetadata): void => {
  if (typeof document === 'undefined') return;
  currentMetadata = metadata;
  document.title = metadata.preserveText ? metadata.title : translateText(metadata.title);
  for (const [attribute, key, value] of metadataEntries(metadata)) {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
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
  if (!metadata.noindex) for (const [locale, href] of languageAlternates(metadata.path)) {
    const link = document.createElement('link'); link.rel = 'alternate'; link.hreflang = locale; link.href = href;
    link.dataset.baylinkLanguage = ''; document.head.append(link);
  }
  document.head.querySelectorAll('script[data-baylink-structured-data]').forEach((element) => element.remove());
  if (metadata.structuredData?.length) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.baylinkStructuredData = '';
    script.textContent = serializeStructuredData(metadataData(metadata));
    document.head.append(script);
  }
};

export const renderMetadataHtml = (metadata: PageMetadata): string => [
  `<title>${escapeHtml(metadata.preserveText ? metadata.title : translateText(metadata.title))}</title>`,
  `<link rel="canonical" href="${escapeHtml(metadataUrl(metadata))}" />`,
  ...(!metadata.noindex ? languageAlternates(metadata.path).map(([locale, href]) => `<link rel="alternate" hreflang="${locale}" href="${escapeHtml(href)}" data-baylink-language />`) : []),
  ...metadataEntries(metadata).map(([attribute, key, value]) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`),
  ...(metadata.structuredData?.length ? [`<script type="application/ld+json" data-baylink-structured-data>${serializeStructuredData(metadataData(metadata))}</script>`] : []),
].join('\n    ');

/** Marker replacement keeps the Vite asset references and avoids serializing user/API objects. */
export const renderHtmlDocument = (template: string, metadata: PageMetadata, body: string): string => {
  const metaPattern = /<!--baylink-meta-start-->[\s\S]*?<!--baylink-meta-end-->/;
  const bodyPattern = /<!--baylink-app-start-->[\s\S]*?<!--baylink-app-end-->/;
  if (!metaPattern.test(template) || !bodyPattern.test(template)) throw new Error('Built HTML is missing BAYLINK render markers');
  return template
    .replace(metaPattern, () => `<!--baylink-meta-start-->\n    ${renderMetadataHtml(metadata)}\n    <!--baylink-meta-end-->`)
    .replace(bodyPattern, () => `<!--baylink-app-start-->\n    <div id="root">${body}</div>\n    <!--baylink-app-end-->`);
};
