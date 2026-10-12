# Daily rebuild: owner setup (每日自动重建：店主设置)

## 中文（店主要做的事，约 5 分钟）

**为什么需要**：首页“本周末”、/events（活动·本周末）和 /calendar（今天）是在每次发布时预先生成的。没有新发布时，搜索引擎、微信/短信链接预览，以及关闭了 JavaScript 的读者，看到的仍是发布那天的周末。网站代码已经会在浏览器里把过期的日期块换成占位条、再显示当天的正确内容（见下方“读者端保护”）；每日重建则让预生成的页面本身也每天更新。

**现状**：代码已上线但**不会做任何事**，直到你设置下面两个环境变量。

**步骤**：
1. Vercel → 项目 baylink-web → Settings → Git → **Deploy Hooks**：名称填 `daily-rebuild`，分支填 `main`，点 Create Hook，复制生成的网址（`https://api.vercel.com/v1/integrations/deploy/…`）。
2. Vercel → Settings → **Environment Variables**（只勾 Production）：
   - `VERCEL_DEPLOY_HOOK_URL` = 上一步复制的网址
   - `CRON_SECRET` = 一串至少 32 位的随机字符（例如在终端运行 `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`）。Vercel 定时任务会自动带上它；没有它，任何人都不能让网站重建。
3. 重新部署一次（Deployments → 最新的 Production → Redeploy），让环境变量生效。
4. 第二天看 Vercel → Settings → **Cron Jobs**：`/api/daily-rebuild` 每天 08:10 UTC 运行（太平洋时间冬令时 00:10、夏令时 01:10；Vercel 免费版 Hobby 的定时任务可能在这一小时内任意时刻触发，即 08:00–08:59 UTC，仍在太平洋时间午夜之后）；Deployments 里会多出一条由 Deploy Hook 触发的发布。

**费用与风险**：每天多 1 次生产构建（约 10–20 分钟构建时长）。构建失败时线上保持上一版，不影响读者。想停用：删掉 `VERCEL_DEPLOY_HOOK_URL` 即可（函数会回到“未配置、什么都不做”）。

**构建失败不会自己报警**：每日重建跑的是和平时发布完全一样的检查（`npm run release:hosting`：代码检查、样式、页面体积预算、图片/分享卡/周报校验等），任何一步不通过，这次构建就失败，线上继续用上一版；而定时任务这边已经成功把请求发给了 Vercel（返回 202），所以不会有任何报错。请这样看：Vercel → **Deployments**，找由 Deploy Hook 触发的那条，红色 **Error/Failed** 就是失败，点进去看 Build Logs 是哪一步；建议在 Vercel 的 **Notifications** 设置里打开“部署失败”（Deployment failures）邮件提醒。和日期有关的检查（比如周报卡片）在某些日子才会出问题，所以开启后的头一两周请留意。

## English (owner action, about 5 minutes)

**Why.** Home's 本周末 block, /events (weekend view) and /calendar (today) are prerendered at deploy time. Between deploys, crawlers, chat link previews and readers without JavaScript keep the build day's weekend. The site already swaps stale date blocks for a skeleton and the current result in the browser (see "Reader-side guard" below); the daily rebuild keeps the prerendered HTML itself current.

**State.** The code ships **inert**: it does nothing until both variables below are set.

**Steps.**
1. Vercel → project baylink-web → Settings → Git → **Deploy Hooks**: name `daily-rebuild`, branch `main`, Create Hook, copy the URL (`https://api.vercel.com/v1/integrations/deploy/…`).
2. Vercel → Settings → **Environment Variables** (Production only):
   - `VERCEL_DEPLOY_HOOK_URL` = the hook URL
   - `CRON_SECRET` = a random string of at least 32 characters. Vercel Cron sends it as `Authorization: Bearer …`; without it nobody else can trigger a rebuild.
3. Redeploy production once so the variables apply.
4. Next day, check Settings → **Cron Jobs**: `/api/daily-rebuild` runs daily at 08:10 UTC (00:10 PST / 01:10 PDT; on the Hobby plan Vercel may fire it at any minute of that hour, 08:00–08:59 UTC, which is still after Pacific midnight), and Deployments shows a deploy-hook build.

**Cost and risk.** One extra production build per day. A failed build leaves the previous deployment live. To stop it, remove `VERCEL_DEPLOY_HOOK_URL` (the function goes back to "not configured").

**A failed daily build is silent.** The daily build runs the same gate as every deploy (`npm run release:hosting`: lint, styles, page-size budgets, image / share-card / weekly checks …). Any red step fails the build and the previous deployment stays live, while the cron function has already handed the request to Vercel (202), so nothing reports an error. Where to look: Vercel → **Deployments**, the deploy-hook build marked **Error**, and its Build Logs for the step. Turn on Vercel's deployment-failure email in **Notifications**. Date-dependent checks (the weekly card, for example) can fail only on some days, so watch the first week or two.

## How it works

- `vercel.json` → `crons: [{ path: '/api/daily-rebuild', schedule: '10 8 * * *' }]`, written by `scripts/sync-public-routes.ts` (`DAILY_REBUILD_CRON`; other cron entries are kept).
- `api/daily-rebuild.ts`: GET only. Without both variables it answers `{ triggered: false, reason: 'not-configured' }`. With them it requires `Authorization: Bearer $CRON_SECRET`, accepts only a `https://api.vercel.com/v1/integrations/deploy/…` URL, POSTs it once (8 s timeout) and answers 202 `{ triggered: true }`, or 502 with the hook's status.
- Tests: `tests/daily-rebuild.test.ts`.

## Reader-side guard (no owner action)

Every prerendered page carries the Pacific date it was built for (`<html data-built-for="YYYY-MM-DD">`). Date-dependent blocks are marked with `dateScope()` from `src/lib/date-guard.ts`: `data-date-scope="weekend"` (本周末 lists: the same from Monday to Saturday; stale on Sunday, which drops Saturday, and from the next Monday) or `data-date-scope="day"` (anything keyed to today: stale on any later day). Today `/events` and `/calendar` are marked (inside the 本周末 list, the travel alerts and the share-card link are `day` blocks of their own); home is covered through its section classes (`.home-weekend`, `.home-weekly-share`, `.home-offers`, and WEB-HOME's `.home-picks`, `.home-feed`, `.home-share`, plus its head: the dateline `.home-head__dateline` as a day block and the weekend count `.home-head__lede` as a weekend block) until its sections carry `dateScope()` — `tests/date-guard.test.tsx` fails when an event, an offer, a `<time>` or an event count on the prerendered home is left uncovered. `public/reading-init.js`, which already runs before the first paint, compares the build date with today's Pacific date and marks the page `data-date-stale`; the stylesheet then shows a fixed-height skeleton in place of those prerendered blocks (and of the same snapshot that SHELL2's boot keeps on screen while the route's code settles) until the app renders the current result. Blocks the app renders itself are never hidden. If the app never starts, the stale blocks reappear after 15 s (with the retry bar) rather than staying blank.
