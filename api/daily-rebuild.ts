import { timingSafeEqual } from 'node:crypto';

/**
 * Daily rebuild (CW-02, EVT11-05). Home's 本周末, /events and /calendar are prerendered for the day of the build, so
 * crawlers, link previews and readers without JavaScript keep the build day's weekend until the next deploy. A Vercel
 * cron (vercel.json `crons`, kept by scripts/sync-public-routes.ts) calls this function once a day just after Pacific
 * midnight; it POSTs the project's Deploy Hook, which rebuilds production from `main`.
 *
 * Inert until the owner sets both environment variables in Vercel (Production):
 * - VERCEL_DEPLOY_HOOK_URL: Project → Settings → Git → Deploy Hooks, branch `main` (https://api.vercel.com/v1/integrations/deploy/…)
 * - CRON_SECRET: a long random string; Vercel sends it as `Authorization: Bearer …` on every cron call.
 * Without both it answers `{ triggered: false, reason: 'not-configured' }` and does nothing. With them, a call without
 * the secret is refused, so nobody else can make the site rebuild. Steps for the owner: docs/daily-rebuild.md.
 */
export type DailyRebuildEnv = { VERCEL_DEPLOY_HOOK_URL?: string; CRON_SECRET?: string };

/** Only Vercel's own deploy-hook endpoint: a mistyped or hostile value never turns this into a request to anywhere else. */
const DEPLOY_HOOK = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9_-]{1,100}(?:\?buildCache=false)?$/u;
const HOOK_TIMEOUT_MS = 8_000;

const reply = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers },
});

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function dailyRebuild(request: Request, env: DailyRebuildEnv = process.env, send: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return reply(405, { error: 'method-not-allowed' }, { Allow: 'GET' });
  const hook = env.VERCEL_DEPLOY_HOOK_URL?.trim() || '', secret = env.CRON_SECRET?.trim() || '';
  if (!hook || !secret) return reply(200, { triggered: false, reason: 'not-configured' });
  if (!sameSecret(request.headers.get('authorization') || '', `Bearer ${secret}`)) return reply(401, { error: 'unauthorized' });
  if (!DEPLOY_HOOK.test(hook)) return reply(500, { triggered: false, reason: 'invalid-hook-url' });
  try {
    const response = await send(hook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(HOOK_TIMEOUT_MS) });
    return response.ok ? reply(202, { triggered: true }) : reply(502, { triggered: false, reason: `hook-status-${response.status}` });
  } catch {
    return reply(502, { triggered: false, reason: 'hook-unreachable' });
  }
}

export default { fetch: (request: Request) => dailyRebuild(request) };
