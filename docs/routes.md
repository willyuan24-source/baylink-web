# Routes: one table, every consumer

`src/app/route-table.ts` is the single source for BAYLINK's URLs (overhaul plan D2). Add or change a route there first;
the tests below fail when another place disagrees.

## What reads the table

| Consumer | File | Field |
|---|---|---|
| App routes | `src/App.tsx` (literal `<Route path>` JSX; `tests/route-table.test.ts` keeps it equal to the table) | `path` |
| Boot preloader | `src/route-loaders.ts` `currentPageLoader` (`pageLoaders` keys = `PAGE_MODULES`) | `page` |
| Known-path check | `src/routing.ts` `isKnownAppPath` (category slugs checked against `SLUG_TO_CATEGORY`) | `path` |
| Nav highlight | `src/lib/ui-navigation.ts` `primaryNavigationPath` | `section` |
| English dictionary scopes | `src/lib/english-loading.ts` `englishScopesForPath` (`/guides/:slug` adds its own) | `english` |
| BayBay page context | `src/lib/baybay-context.ts` `bayBayPageSearchContext` | `baybay` |
| Prerender modules + route CSS | `scripts/prerender.tsx` (`routeModule`, `withRouteStylesheets`) | `page` |
| Sitemap | `scripts/generate-sitemap.ts` (static pages, then every published id; x-default = zh-Hans) | `sitemap` |
| Hosting routes | `scripts/sync-public-routes.ts` `tableHostingRoutes` → `vercel.json` | `hosting`, `redirect` |
| Release checks | `scripts/verify-release.mjs` (pages in 3 languages, route stylesheets, legacy URLs) | `release` |
| Analytics route template | `routeTemplate(pathname)` → `'/events/:id'` or `'other'` (never the raw URL) | `path` |

`vercel.json` is generated: run `npm run sync:public-routes` (also part of `pretest` and `prebuild`) and commit the result.

## Sections (one per URL)

| Section | Tab | Routes |
|---|---|---|
| `home` | 首页 | `/` |
| `events` | 活动 | `/events`, `/this-month`, `/this-week`→, `/calendar`, `/events/:id`, `/offers/:id`, `/openings/:id`, `/ai-in-the-bay`, `/plan`, `/together`, `/recommend`→ |
| `guides` | 指南 | `/guides`, `/guides/:slug`, `/tools`, `/explore`, `/archive` |
| `me` | 我的 | `/me`, `/me/bookings`, `/my-week`, `/messages`, `/messages/:threadId` |
| `more` | (更多, no primary tab) | `/category/:categorySlug`, `/posts/:postId`, `/users/:userId` (邻里), `/about`, `/privacy`, `/terms`, `/sms-consent`, `/opus-bay`, `/play` |
| `none` | — | `/reset-password`, `/verify-email`, `/notifications/unsubscribe` |

## Legacy and shared URLs

Every redirect keeps the request's query (Vercel passes it through to `Location`).

| URL | Answer | Why |
|---|---|---|
| `/events` (+ `/en`, `/zh-Hant`) | 200 `events.html` | 活动 column, 本周末 first (D3) |
| `/calendar`, `/this-month` | 200 | 日历·地图 view and the autumn edition; the 3D game links both |
| `/this-week?…` | 301 → `/events?…` | D3; also redirected inside the app (`LegacyRedirect`) |
| `/recommend` | 301 → `/events` | Owner decision 10/08 (RC-24) |
| `/n/{all,sf,east-bay,peninsula,south-bay,north-bay}` | 302 → `/events?region=…&from=card-…` | Printed weekly-card QR codes; 302 so the landing can move again |
| `?lang=en` / `?lang=zh-Hant` on an unprefixed page | 301 → `/en/…` / `/zh-Hant/…` | Links built by the 3D game and `cityExplorationUrl`; not `/opus-bay`, `/play` or the email token pages |
| `/play`, `/play?stops=…` | `play.html` / `plan.html` | OPUS contract; old weekend tickets |
| `/plan?stops=…`, `/my-week` | 200 | 3D deep links |

`scripts/hosting-routes.mjs` holds this list (`LEGACY_URLS`) and a resolver that walks `vercel.json` like Vercel does.
`tests/legacy-urls.test.ts` and `npm run verify:release` run it offline.

### Post-deploy check (read-only)

```
node scripts/hosting-routes.mjs https://www.baylink.us
```

GETs each URL without following redirects and prints `ok`/`FAIL` with the status and `Location`. Run it after the
deploy that ships this table, and again after any change to `vercel.json`.

Every response also carries `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
