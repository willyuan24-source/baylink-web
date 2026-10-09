/**
 * Read-only port of the live API's request validation for the three WEB-FEEDBACK endpoints, so tests can dry-run the
 * web's payloads against the contract without posting anything to production (plan §3.0 Web↔API contracts).
 * Source: baylink-backend main 00ab26d (#26 API-FUNC): lib/routeTemplates.js, lib/feedback.js normalizeFeedback,
 * lib/clientErrors.js (POST /api/client-errors body check) and lib/productMetrics.js (POST /api/product-events body
 * check). Keep in step with those files; a change there that this port misses shows up as a 400 in production.
 */
export const ROUTE_TEMPLATES = Object.freeze([
  '/', '/events', '/events/:id', '/calendar', '/this-week', '/this-month',
  '/offers/:id', '/openings/:id', '/guides', '/guides/:slug', '/category/:slug',
  '/plan', '/my-week', '/me', '/me/bookings', '/messages', '/messages/:id',
  '/together', '/posts/:id', '/users/:id', '/explore', '/tools', '/about', '/archive',
  '/opus-bay', '/ai-in-the-bay', '/privacy', '/terms', '/sms-consent',
  '/reset-password', '/verify-email', '/notifications/unsubscribe',
  '/play', '/recommend',
  '/not-found', 'other',
]);
const MAX_ROUTE_INPUT = 300;
const LOCALE_PREFIX = /^\/(?:en|zh-Hant|zh-Hans)(?=\/|$)/;
const PARAM_SEGMENT = /^(?::[A-Za-z][A-Za-z0-9]{0,40}|[A-Za-z0-9._~%-]{1,160})$/;
const PATTERNS = ROUTE_TEMPLATES.filter(template => template !== 'other')
  .map(template => ({ template, segments: template === '/' ? [] : template.slice(1).split('/') }));

/** lib/routeTemplates.js routeTemplate: the stored template, 'other', or null (a non-string, which is a 400). */
export function apiRouteTemplate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value === 'other') return 'other';
  if (!value || value.length > MAX_ROUTE_INPUT || value[0] !== '/' || value.startsWith('//') || value.includes('\\')) return 'other';
  let path = value.split(/[?#]/, 1)[0].replace(LOCALE_PREFIX, '') || '/';
  if (path.length > 1) path = path.replace(/\/+$/, '') || '/';
  const segments = path === '/' ? [] : path.slice(1).split('/');
  const found = PATTERNS.find(pattern => pattern.segments.length === segments.length
    && pattern.segments.every((segment, index) => segment.startsWith(':') ? PARAM_SEGMENT.test(segments[index]) : segment === segments[index]));
  return found ? found.template : 'other';
}

const COMMIT = /^[0-9a-f]{7,40}$/i;
const RELEASE_LABEL = /^[a-z0-9][a-z0-9._-]{0,31}$/i;
/** lib/clientErrors.js releaseLabel */
export function apiReleaseLabel(value: unknown): string | null {
  if (value === undefined) return 'unknown';
  if (typeof value !== 'string') return null;
  if (COMMIT.test(value)) return value.slice(0, 12).toLowerCase();
  return RELEASE_LABEL.test(value) ? value.toLowerCase() : 'unknown';
}

const plainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const FEEDBACK_REASONS: Record<string, readonly string[]> = {
  page: ['find-events', 'get-help', 'ask-baybay', 'plan', 'other'],
  content: ['outdated', 'wrong-time', 'wrong-place', 'wrong-price', 'broken-link', 'closed', 'other'],
  baybay: ['wrong-answer', 'too-slow', 'not-answered', 'other'],
};
const FEEDBACK_FIELDS = ['kind', 'routeTemplate', 'reason', 'text', 'contact', 'entity', 'locale', 'readingSize', 'release', 'website'];
const ENTITY_KINDS = ['event', 'place', 'guide', 'offer', 'opening', 'post'];
const ENTITY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/g;
const readerText = (value: unknown, maximum: number) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\r\n?/g, '\n').replace(UNSAFE_CHARACTERS, '').trim();
  return [...clean].length <= maximum ? clean : null;
};

/** lib/feedback.js normalizeFeedback: the stored row, or null (400 FEEDBACK_INVALID). */
export function apiNormalizeFeedback(body: unknown) {
  if (!plainObject(body) || Object.keys(body).some(key => !FEEDBACK_FIELDS.includes(key))) return null;
  const { kind, reason } = body;
  if (typeof kind !== 'string' || !FEEDBACK_REASONS[kind] || typeof reason !== 'string' || !FEEDBACK_REASONS[kind].includes(reason)) return null;
  const route = body.routeTemplate === undefined ? 'other' : apiRouteTemplate(body.routeTemplate);
  const text = readerText(body.text, 500);
  const contact = readerText(body.contact, 80);
  const release = apiReleaseLabel(body.release);
  if (route === null || text === null || contact === null || release === null) return null;
  if (body.locale !== undefined && !['zh-Hans', 'zh-Hant', 'en'].includes(body.locale as string)) return null;
  if (body.readingSize !== undefined && !['standard', 'large', 'extra-large'].includes(body.readingSize as string)) return null;
  let entity;
  if (body.entity !== undefined) {
    const value = body.entity;
    if (!plainObject(value) || Object.keys(value).some(key => !['kind', 'id'].includes(key))
      || !ENTITY_KINDS.includes(value.kind as string) || typeof value.id !== 'string' || !ENTITY_ID.test(value.id)) return null;
    entity = { kind: value.kind, id: value.id };
  }
  return { kind, reason, route, text, ...(contact ? { contact } : {}), ...(entity ? { entity } : {}),
    locale: (body.locale as string) || 'zh-Hans', readingSize: (body.readingSize as string) || 'standard', release };
}

/** lib/clientErrors.js POST /api/client-errors: true when the body is accepted (200), false for a 400. */
export function apiAcceptsClientError(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  const release = apiReleaseLabel(value.release);
  const route = value.route === undefined ? 'other' : apiRouteTemplate(value.route);
  return !Object.keys(value).some(key => !['kind', 'route', 'release', 'fp'].includes(key))
    && ['render', 'error', 'rejection', 'chunk'].includes(value.kind as string)
    && typeof value.fp === 'string' && /^[a-z0-9]{6,16}$/.test(value.fp) && route !== null && release !== null;
}

/** lib/productMetrics.js POST /api/product-events: true when the body is accepted, for a client (not server) event. */
export function apiAcceptsProductEvent(body: unknown, allowedEvents: readonly string[]): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return !Object.keys(value).some(key => !['event', 'locale', 'route'].includes(key))
    && allowedEvents.includes(value.event as string)
    && (value.locale === undefined || ['zh-Hans', 'zh-Hant', 'en'].includes(value.locale as string))
    && (value.route === undefined || apiRouteTemplate(value.route) !== null);
}

/** The client events lib/productMetrics.js PRODUCT_EVENTS accepts (server-only events and opus_* excluded). */
export const API_CLIENT_EVENTS = Object.freeze([
  'planner_recommendation', 'plan_saved', 'plan_shared', 'planner_outing_adopted', 'planner_edit_applied', 'planner_web_search',
  'official_source_click', 'favorite_saved', 'planner_map_opened', 'nav_click', 'home_module_click', 'search_submitted',
  'search_zero_result', 'event_detail_open', 'ics_download', 'share_card_download', 'baybay_ask', 'baybay_degraded',
  'baybay_fast', 'baybay_slow', 'baybay_helpful', 'baybay_unhelpful', 'signup_gate', 'contact_click', 'message_first_sent',
  'site_arrival_from_card', 'site_arrival_from_opus', 'client_error', 'newsletter_signup', 'page_view', 'site_source_direct',
  'site_source_search', 'site_source_wechat', 'site_source_social', 'site_source_card', 'site_source_opus', 'site_source_other',
  'baybay_latency_lt3', 'baybay_latency_3to8', 'baybay_latency_8to15', 'baybay_latency_gt15', 'feedback_open', 'feedback_sent',
]);
