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

export type PageMetadata = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  structuredData?: Record<string, unknown>[];
};

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

export const absolutePageUrl = (path: string): string => {
  const localPath = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  const url = new URL(localPath, SITE_URL);
  if (url.origin !== SITE_URL) return `${SITE_URL}/`;
  url.search = '';
  url.hash = '';
  return url.href;
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
  return [
    ['name', 'description', translateText(metadata.description)],
    ['name', 'robots', metadata.noindex ? 'noindex, follow' : 'index, follow'],
    ['property', 'og:type', metadata.type || 'website'],
    ['property', 'og:site_name', 'BAYLINK'],
    ['property', 'og:title', translateText(metadata.title)],
    ['property', 'og:description', translateText(metadata.description)],
    ['property', 'og:url', absolutePageUrl(metadata.path)],
    ['property', 'og:image', image],
    ['property', 'og:locale', metadataLocale],
    ['name', 'twitter:card', image === DEFAULT_SOCIAL_IMAGE ? 'summary' : 'summary_large_image'],
    ['name', 'twitter:title', translateText(metadata.title)],
    ['name', 'twitter:description', translateText(metadata.description)],
    ['name', 'twitter:image', image],
  ];
};

// JSON-LD is data, but HTML parsers still recognize a closing script tag inside strings.
export const serializeStructuredData = (data: Record<string, unknown>[]): string =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Used on client navigation. Importing this module is also safe during server rendering. */
let currentMetadata: PageMetadata | undefined;
export const setPageMetadata = (metadata: PageMetadata): void => {
  if (typeof document === 'undefined') return;
  currentMetadata = metadata;
  document.title = translateText(metadata.title);
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
  canonical.href = absolutePageUrl(metadata.path);
  document.head.querySelectorAll('script[data-baylink-structured-data]').forEach((element) => element.remove());
  if (metadata.structuredData?.length) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.baylinkStructuredData = '';
    script.textContent = serializeStructuredData(translateStructuredData(metadata.structuredData));
    document.head.append(script);
  }
};

export const renderMetadataHtml = (metadata: PageMetadata): string => [
  `<title>${escapeHtml(metadata.title)}</title>`,
  `<link rel="canonical" href="${escapeHtml(absolutePageUrl(metadata.path))}" />`,
  ...metadataEntries(metadata).map(([attribute, key, value]) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`),
  ...(metadata.structuredData?.length ? [`<script type="application/ld+json" data-baylink-structured-data>${serializeStructuredData(metadata.structuredData)}</script>`] : []),
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
