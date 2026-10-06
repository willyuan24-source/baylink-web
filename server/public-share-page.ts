import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml, renderHtmlDocument, safeSocialImage, SITE_URL, type PageMetadata } from '../src/lib/seo.js';

export type PublicShareDependencies = { fetch?: typeof fetch; readTemplate?: () => Promise<string>; apiBase?: string };
type Kind = 'outing' | 'user';
type Language = 'zh-Hans' | 'zh-Hant' | 'en';
type PublicContent = { title: string; description: string; body: string; image?: string; structuredData: Record<string, unknown>[] };
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown, max = 2000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validId = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,139}$/.test(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const instant = (value: unknown): string | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8.64e15 ? new Date(value).toISOString() : undefined;
const validDay = (value: string) => /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const pacificClock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const sameLocalMoment = (value: unknown, date: string, clock: string) => {
  if (!instant(value)) return false;
  const parts = Object.fromEntries(pacificClock.formatToParts(new Date(value as number)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}` === date && `${parts.hour}:${parts.minute}` === clock;
};
const list = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.map(item => text(item, 60)).filter(Boolean))].slice(0, 12) : [];
const imageUrl = (value: unknown): string | undefined => {
  const source = text(value, 2048);
  if (!source || (!source.startsWith('https://') && !/^\/(?!\/)/.test(source))) return undefined;
  try { const url = new URL(source, SITE_URL); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
};
const unavailableRecord = (value: Record<string, unknown>) => value.adminHidden === true || value.isDeleted === true || value.isBanned === true || value.deletionPending === true || ['suspended', 'deletion_pending'].includes(String(value.accountStatus));
const headers = (status: number) => ({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, follow', ...(status === 503 ? { 'Retry-After': '60' } : {}) });

function copy(lang: Language) {
  return lang === 'en' ? {
    missing: 'This public page is unavailable', unavailable: 'This page could not be loaded', retry: 'Please try again later or browse other Bay Area information.',
    outing: 'Independent adult outing', user: 'Public neighbor card', source: 'Public source', browse: 'Browse Bay Area information',
    venue: 'Meeting place', cost: 'Cost note', host: 'Host', capacity: 'Group capacity', confirmed: 'Confirmed members', posts: 'Public posts',
    status: { open: 'Open', cancelled: 'Cancelled', completed: 'Ended' },
    outingNote: 'Check the latest arrangement before leaving. Participation requests and team discussions are available after the page loads.',
    userNote: 'These are the profile details the account has made public. Contact and messaging controls are available after the page loads.',
  } : lang === 'zh-Hant' ? {
    missing: '這個公開頁面暫不可用', unavailable: '頁面暫時無法載入', retry: '請稍後重試，或繼續瀏覽其他灣區資訊。',
    outing: '成年人自發小隊', user: '鄰居公開名片', source: '公開資料來源', browse: '繼續瀏覽灣區資訊',
    venue: '集合地點', cost: '費用說明', host: '發起人', capacity: '小隊上限', confirmed: '已確認人數', posts: '公開貼文',
    status: { open: '開放中', cancelled: '已取消', completed: '已結束' },
    outingNote: '出發前請回小隊核對最新安排。加入申請與小隊討論可在頁面載入後使用。',
    userNote: '這裡只展示帳戶已公開的名片資料。聯絡與私訊操作可在頁面載入後使用。',
  } : {
    missing: '这个公开页面暂不可用', unavailable: '页面暂时无法加载', retry: '请稍后重试，或继续浏览其他湾区信息。',
    outing: '成年人自发小队', user: '邻居公开名片', source: '公开资料来源', browse: '继续浏览湾区信息',
    venue: '集合地点', cost: '费用说明', host: '发起人', capacity: '小队上限', confirmed: '已确认人数', posts: '公开帖子',
    status: { open: '开放中', cancelled: '已取消', completed: '已结束' },
    outingNote: '出发前请回小队核对最新安排。加入申请与小队讨论可在页面加载后使用。',
    userNote: '这里只展示账户已公开的名片资料。联系与私信操作可在页面加载后使用。',
  };
}

/** Project anonymous outing DTO fields individually; never embed members, applicants, notes, polls or messages. */
function publicOuting(value: unknown, id: string, lang: Language, canonical: string): PublicContent | null {
  const item = record(record(value)?.outing);
  if (!item || item.id !== id || !text(item.title, 160)) return null;
  const date = text(item.date, 40), start = text(item.startTime, 40), end = text(item.endTime, 40);
  const startAt = instant(item.startAt), endAt = instant(item.endAt);
  if (!validDay(date) || !validTime(start) || !validTime(end) || end <= start || !startAt || !endAt || Number(item.endAt) <= Number(item.startAt) || !sameLocalMoment(item.startAt, date, start) || !sameLocalMoment(item.endAt, date, end) || item.timezone !== 'America/Los_Angeles'
    || !['open', 'cancelled', 'completed'].includes(String(item.status)) || !integer(item.capacity) || item.capacity < 2 || item.capacity > 8
    || (item.confirmedCount !== undefined && (!integer(item.confirmedCount) || item.confirmedCount > item.capacity))) return null;
  const c = copy(lang), title = text(item.title, 160), description = text(item.description), city = text(item.city, 100), venue = text(item.venue, 200), cost = text(item.costNote, 500);
  const nickname = text(record(item.host)?.nickname, 200), officialUrl = imageUrl(item.officialUrl);
  const status = c.status[item.status as keyof typeof c.status];
  const facts = [date, `${start}–${end}`, city, status].filter(Boolean).join(' · ');
  const eventData: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'Event', name: title, description, url: canonical, startDate: startAt, endDate: endAt,
    ...(venue ? { location: { '@type': 'Place', name: venue, ...(city ? { address: { '@type': 'PostalAddress', addressLocality: city } } : {}) } } : {}),
    ...(item.status === 'cancelled' ? { eventStatus: 'https://schema.org/EventCancelled' } : {}), ...(instant(item.updatedAt) ? { dateModified: instant(item.updatedAt) } : {}) };
  return { title, description: [facts, cost, description.replace(/\s+/g, ' ').slice(0, 120)].filter(Boolean).join(' · ').slice(0, 260), structuredData: [eventData],
    body: `<article translate="no"><p>${c.outing}</p><h1 class="mt-4 text-2xl font-bold">${escapeHtml(title)}</h1><p class="mt-3"><time datetime="${escapeHtml(date)}">${escapeHtml(date)}</time> · ${escapeHtml(start)}–${escapeHtml(end)} · America/Los_Angeles · ${escapeHtml(status)}</p><dl class="mt-4 space-y-2">${city || venue ? `<div><dt>${c.venue}</dt><dd>${escapeHtml([city, venue].filter(Boolean).join(' · '))}</dd></div>` : ''}${cost ? `<div><dt>${c.cost}</dt><dd>${escapeHtml(cost)}</dd></div>` : ''}${nickname ? `<div><dt>${c.host}</dt><dd>${escapeHtml(nickname)}</dd></div>` : ''}<div><dt>${c.capacity}</dt><dd>${item.capacity}</dd></div>${integer(item.confirmedCount) ? `<div><dt>${c.confirmed}</dt><dd>${item.confirmedCount}</dd></div>` : ''}</dl>${description ? `<p class="mt-5 whitespace-pre-wrap leading-relaxed">${escapeHtml(description)}</p>` : ''}${officialUrl ? `<a class="mt-4 inline-block underline" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">${c.source}</a>` : ''}<p class="mt-6 text-sm">${c.outingNote}</p></article>` };
}

/** The /users/:id/public DTO already enforces visibility; honor explicit false flags defensively as well. */
function publicUser(value: unknown, id: string, lang: Language, canonical: string): PublicContent | null {
  const item = record(value);
  if (!item || item.id !== id || !text(item.nickname, 200)) return null;
  const c = copy(lang), nickname = text(item.nickname, 200), bio = text(item.bio), status = text(item.statusText, 300), visibility = record(item.profileVisibility);
  const location = visibility?.location === false ? '' : [text(item.area, 100), text(item.city, 100)].filter(Boolean).join(' · ');
  const tags = list(item.profileTags), interests = visibility?.interests === false ? [] : list(item.interests);
  const image = imageUrl(item.coverImage) || imageUrl(item.avatar);
  const recentPosts = Array.isArray(item.recentPosts) ? item.recentPosts.slice(0, 3).flatMap(value => {
    const post = record(value); const postId = text(post?.id || post?._id, 140), title = text(post?.title, 160);
    return post && !unavailableRecord(post) && validId(postId) && title ? [{ id: postId, title }] : [];
  }) : [];
  const prefix = lang === 'zh-Hans' ? '' : `/${lang}`;
  const description = [status, location, bio.replace(/\s+/g, ' ').slice(0, 180)].filter(Boolean).join(' · ') || c.user;
  return { title: nickname, description, image, structuredData: [{ '@context': 'https://schema.org', '@type': 'ProfilePage', url: canonical,
    ...(instant(item.createdAt) ? { dateCreated: instant(item.createdAt) } : {}), mainEntity: { '@type': 'Person', name: nickname, ...(bio ? { description: bio } : {}), ...(image ? { image } : {}) } }],
    body: `<article translate="no"><p>${c.user}</p><h1 class="mt-4 text-2xl font-bold">${escapeHtml(nickname)}</h1>${image ? `<img src="${escapeHtml(safeSocialImage(image))}" alt="${escapeHtml(nickname)}" class="mt-5 max-h-[360px] max-w-full rounded-2xl object-contain" />` : ''}${location ? `<p class="mt-3">${escapeHtml(location)}</p>` : ''}${status ? `<p class="mt-3">${escapeHtml(status)}</p>` : ''}${bio ? `<p class="mt-5 whitespace-pre-wrap leading-relaxed">${escapeHtml(bio)}</p>` : ''}${tags.length || interests.length ? `<p class="mt-3">${escapeHtml([...tags, ...interests].join(' · '))}</p>` : ''}${integer(item.postCount) ? `<p class="mt-5">${c.posts}: ${item.postCount}</p>` : ''}${recentPosts.length ? `<ul class="mt-3 space-y-2">${recentPosts.map(post => `<li><a href="${prefix}/posts/${encodeURIComponent(post.id)}" class="underline">${escapeHtml(post.title)}</a></li>`).join('')}</ul>` : ''}<p class="mt-6 text-sm">${c.userNote}</p></article>` };
}

export async function renderPublicSharePage(request: Request, kind: Kind, dependencies: PublicShareDependencies = {}): Promise<Response> {
  const url = new URL(request.url), routePrefix = /^\/(en|zh-Hant)(?=\/|$)/.exec(url.pathname)?.[1];
  const language = routePrefix || url.searchParams.get('siteLanguage') || url.searchParams.get('lang');
  const lang: Language = language === 'en' ? 'en' : language === 'zh-Hant' ? 'zh-Hant' : 'zh-Hans';
  const prefix = lang === 'zh-Hans' ? '' : `/${lang}`, locale = lang === 'en' ? 'en_US' : lang === 'zh-Hant' ? 'zh_TW' : 'zh_CN', c = copy(lang);
  const id = kind === 'user' ? /^\/(?:(?:en|zh-Hant)\/)?users\/([^/]+)\/?$/.exec(url.pathname)?.[1] || url.searchParams.get('userId') || '' : url.searchParams.get('outingId') || url.searchParams.get('outing') || '';
  const valid = validId(id);
  const path = valid ? kind === 'user' ? `${prefix}/users/${id}` : `${prefix}/together?outing=${encodeURIComponent(id)}` : `${prefix}/404`;
  const canonical = SITE_URL + path;
  const metadata = (title: string, description: string): PageMetadata => ({ title: `${title}｜BAYLINK`, description, path, noindex: true, preserveText: true, locale });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...headers(405), Allow: 'GET, HEAD' } });
  let template: string;
  try {
    template = await (dependencies.readTemplate?.() || readFile(join(process.cwd(), 'dist/index.html'), 'utf8'));
    renderHtmlDocument(template, metadata(c.unavailable, c.retry), '');
  } catch {
    return new Response(request.method === 'HEAD' ? null : `<!doctype html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>${c.unavailable}｜BAYLINK</title></head><body><h1>${c.unavailable}</h1><p>${c.retry}</p></body></html>`, { status: 503, headers: headers(503) });
  }
  const respond = (status: number, page: PageMetadata, body: string): Response => {
    // /together uses a validated public identifier in its query; retain it in canonical/OG without retaining any other request query.
    const html = renderHtmlDocument(template, page, `<main class="mx-auto max-w-3xl px-5 py-8"><a href="${prefix}/" class="font-bold text-baylink-green">BAYLINK</a>${body}<a href="${prefix}/" class="mt-5 inline-block underline">${c.browse}</a></main>`)
      .replace(/<html lang="[^"]+"/, `<html lang="${lang}"`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, (_, before, after) => before + escapeHtml(canonical) + after)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, (_, before, after) => before + escapeHtml(canonical) + after);
    return new Response(request.method === 'HEAD' ? null : html, { status, headers: headers(status) });
  };
  const failure = (status: number) => respond(status, metadata(status === 404 ? c.missing : c.unavailable, c.retry), `<h1 class="mt-6 text-2xl font-bold">${status === 404 ? c.missing : c.unavailable}</h1><p class="mt-3">${c.retry}</p>`);
  if (!valid) return failure(404);
  try {
    const apiBase = (dependencies.apiBase || process.env.BAYLINK_PUBLIC_API_URL || process.env.VITE_API_BASE_URL || 'https://baylink-api.onrender.com/api').replace(/\/$/, '');
    const endpoint = kind === 'user' ? `/users/${encodeURIComponent(id)}/public` : `/outings/${encodeURIComponent(id)}`;
    const response = await (dependencies.fetch || fetch)(apiBase + endpoint, { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (response.status === 404 || response.status === 410) return failure(404);
    if (!response.ok) return failure(503);
    const data: unknown = await response.json(), item = kind === 'user' ? record(data) : record(record(data)?.outing);
    if (item && unavailableRecord(item)) return failure(404);
    const content = kind === 'user' ? publicUser(data, id, lang, canonical) : publicOuting(data, id, lang, canonical);
    if (!content) return failure(503);
    return respond(200, { ...metadata(content.title, content.description), image: content.image, type: kind === 'user' ? 'website' : 'article', structuredData: content.structuredData }, content.body);
  } catch { return failure(503); }
}
