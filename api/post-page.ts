import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml, renderHtmlDocument, safeSocialImage, type PageMetadata } from '../src/lib/seo.js';

type PublicPost = {
  id: string;
  title: string;
  description: string;
  city: string;
  category: string;
  budget: string;
  image?: string;
  closed: boolean;
};

type Dependencies = {
  fetch?: typeof fetch;
  readTemplate?: () => Promise<string>;
  apiBase?: string;
};

const textValue = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
const objectValue = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Explicit public-content allowlist. Never serialize the API response, author, contact or viewer fields. */
const publicPost = (value: unknown, id: string): PublicPost | null => {
  const envelope = objectValue(value);
  const record = objectValue(envelope?.post) || envelope;
  if (!record || textValue(record.id || record._id, 128) !== id || !textValue(record.title, 160)) return null;
  const images = Array.isArray(record.imageUrls) ? record.imageUrls : Array.isArray(record.images) ? record.images : [record.imageUrl];
  const image = images.find((item) => typeof item === 'string' && /^(https:\/\/|\/(?!\/))/.test(item)) as string | undefined;
  return {
    id,
    title: textValue(record.title, 160),
    description: textValue(record.description, 20_000),
    city: textValue(record.city, 100),
    category: textValue(record.category, 60),
    budget: textValue(record.budget, 100),
    image,
    closed: record.status === 'closed',
  };
};

const responseHeaders = (status: number) => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  ...(status !== 200 ? { 'X-Robots-Tag': 'noindex, follow' } : {}),
  ...(status === 503 ? { 'Retry-After': '60' } : {}),
});

export async function renderPublicPostPage(request: Request, dependencies: Dependencies = {}): Promise<Response> {
  const url = new URL(request.url);
  const route = /^\/(?:(en|zh-Hant)\/)?posts\/([^/]+)\/?$/.exec(url.pathname);
  const language = route?.[1] || url.searchParams.get('siteLanguage');
  const lang = language === 'en' ? 'en' : language === 'zh-Hant' ? 'zh-Hant' : 'zh-Hans';
  const locale = lang === 'en' ? 'en_US' : lang === 'zh-Hant' ? 'zh_TW' : 'zh_CN';
  const prefix = lang === 'zh-Hans' ? '' : `/${lang}`;
  const copy = lang === 'en' ? {
    missing: 'Post not found', unavailable: 'Post temporarily unavailable',
    missingDetail: 'The post may have been deleted or the link may be incorrect. You can browse other local information.',
    unavailableDetail: 'The post service is temporarily unavailable. Please try again later.',
    browse: 'Browse local information', closed: 'Ended', confirm: 'Confirm availability before contacting',
    image: 'Post image', note: 'Confirm the location, price and dates with the author before contacting. Messaging and contact requests are available after the page loads.',
  } : lang === 'zh-Hant' ? {
    missing: '貼文不存在', unavailable: '貼文暫時無法載入',
    missingDetail: '貼文可能已刪除或連結有誤。你可以繼續瀏覽其他本地資訊。',
    unavailableDetail: '貼文服務暫時無法連接，請稍後重試。',
    browse: '瀏覽本地資訊', closed: '已結束', confirm: '聯絡前請確認仍有效',
    image: '貼文配圖', note: '聯絡發布者前，請確認地點、價格和時間。私訊和聯絡方式請求可在頁面載入後使用。',
  } : {
    missing: '帖子不存在', unavailable: '帖子暂时无法加载',
    missingDetail: '帖子可能已删除或链接有误。你可以继续浏览其他本地信息。',
    unavailableDetail: '帖子服务暂时无法连接，请稍后重试。',
    browse: '浏览本地信息', closed: '已结束', confirm: '联系前请确认仍有效',
    image: '帖子配图', note: '联系发布者前，请确认地点、价格和时间。私信和联系方式请求可在页面加载后使用。',
  };
  const pathId = route?.[2];
  const id = pathId || url.searchParams.get('postId') || '';
  const validId = /^[a-zA-Z0-9_-]{1,128}$/.test(id);
  const path = validId ? `${prefix}/posts/${id}` : `${prefix}/404`;
  const metadataForError = (status: number): PageMetadata => ({
    title: `${status === 404 ? copy.missing : copy.unavailable}｜BAYLINK`,
    description: status === 404 ? copy.missingDetail : copy.unavailableDetail,
    path,
    noindex: true,
    preserveText: true,
    locale,
  });
  let template: string;
  try {
    template = await (dependencies.readTemplate?.() || readFile(join(process.cwd(), 'dist/index.html'), 'utf8'));
    // Detect an incomplete build before any response path tries to render it.
    renderHtmlDocument(template, metadataForError(503), '');
  } catch {
    return new Response(request.method === 'HEAD' ? null : `<!doctype html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>${copy.unavailable}｜BAYLINK</title></head><body><h1>${copy.unavailable}</h1><p>${copy.unavailableDetail}</p></body></html>`, { status: 503, headers: responseHeaders(503) });
  }
  const respond = (status: number, metadata: PageMetadata, body: string) => new Response(request.method === 'HEAD' ? null : renderHtmlDocument(template, metadata, `<main class="mx-auto max-w-3xl px-5 py-8"><a href="${prefix}/" class="font-bold text-baylink-green">BAYLINK</a>${body}</main>`).replace(/<html lang="[^"]+"/, `<html lang="${lang}"`), { status, headers: responseHeaders(status) });
  const errorResponse = (status: number) => {
    const metadata = metadataForError(status);
    return respond(status, metadata, `<h1 class="mt-6 text-2xl font-bold">${escapeHtml(metadata.title.replace('｜BAYLINK', ''))}</h1><p class="mt-3">${escapeHtml(metadata.description)}</p><a href="${prefix}/" class="mt-5 inline-block underline">${copy.browse}</a>`);
  };
  if (!validId) return errorResponse(404);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...responseHeaders(405), Allow: 'GET, HEAD' } });

  try {
    const apiBase = (dependencies.apiBase || process.env.BAYLINK_PUBLIC_API_URL || process.env.VITE_API_BASE_URL || 'https://baylink-api.onrender.com/api').replace(/\/$/, '');
    const response = await (dependencies.fetch || fetch)(`${apiBase}/posts/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 404 || response.status === 410) return errorResponse(404);
    if (!response.ok) return errorResponse(503);
    const data: unknown = await response.json();
    const record = objectValue(objectValue(data)?.post) || objectValue(data);
    if (record?.adminHidden === true) return errorResponse(404);
    const post = publicPost(data, id);
    if (!post) return errorResponse(503);
    const description = post.description.replace(/\s+/g, ' ').slice(0, 180) || [post.category, post.city, post.budget].filter(Boolean).join(' · ');
    const metadata: PageMetadata = { title: `${post.title}｜BAYLINK`, description, path, image: post.image, type: 'article', noindex: post.closed, preserveText: true, locale };
    const body = `<article translate="no"><h1 class="mt-6 text-2xl font-bold">${escapeHtml(post.title)}</h1><p class="mt-3 text-sm">${escapeHtml([post.category, post.city, post.budget, post.closed ? copy.closed : copy.confirm].filter(Boolean).join(' · '))}</p>${post.image ? `<img src="${escapeHtml(safeSocialImage(post.image))}" alt="${copy.image}" class="mt-5 max-h-[500px] max-w-full rounded-2xl object-contain" />` : ''}<p class="mt-5 whitespace-pre-wrap leading-relaxed">${escapeHtml(post.description)}</p><p class="mt-6 text-sm">${copy.note}</p><a href="${prefix}/" class="mt-5 inline-block underline">${copy.browse}</a></article>`;
    const result = respond(200, metadata, body);
    return request.method === 'HEAD' ? new Response(null, { status: 200, headers: result.headers }) : result;
  } catch {
    return errorResponse(503);
  }
}

// Vercel Node.js Web Handler; see https://vercel.com/docs/functions/runtimes/node-js.
export default { fetch: (request: Request) => renderPublicPostPage(request) };
