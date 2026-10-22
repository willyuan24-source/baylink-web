# BAYLINK overhaul plan: the core (public copy)

> 公开副本：从店主电脑上的 `opus-qa/overhaul/MASTER-PLAN.md`（2026-10-07 23:50 PT 写，10-08 加了 Critic review）摘出来的五部分，加上 Critic 的 40 条必改规则（RC-1…RC-40）：§0.2 决策（D1–D26）、§1 产品与信息架构、§2 评分目标、§3.0 全局规则 / OPUS 契约 / 热文件、§5 复审方法。其余章节（Wave 0–3 的 lane、店主日程、风险）已经过时或含私有信息，没有收进来。
> **怎么读**：这些是 10-07 定的规则和目标。RC 规则优先于正文；之后店主的决定（`HANDOFF.md` §7）又优先于这里。文中的分数、日期和 lane 名是当时的计划，不是现状；现状看 `HANDOFF.md` §2 和 `ROADMAP-8-9.md`。
> 路径都是店主 Windows 电脑上的（`C:/Users/willy/...`）；换电脑时的对应关系见 `HANDOFF.md` "在新电脑 / 新 Mac 上继续"。已脱敏：不含密钥、key 文件位置、账号或组织信息。

Goal at plan time: move the site from 5.4/10 on the 1007 rubric to at least 8.0 weighted, with "图文结合" and "功能走通" each at 8 or above. Effort: S < ½ agent-day, M ½–2, L > 2. File paths are relative to the repo root: web = `baylink-web`, api = `baylink-api`.

---

### 0.2 Decision log

These decisions are binding for every lane. The owner can reopen any of them; until he does, lanes implement them.

| # | Decision | Why / evidence |
|---|---|---|
| D1 | **No rewrite.** Overhaul the static-prerender + SPA architecture incrementally | frontend.md §0 |
| D2 | **One route table**, `src/app/route-table.ts`. It is the single source for routes, loaders, nav section, prerender, sitemap, hosting routes, BayBay page context, `verify-release` page list and analytics route templates | 6–8 duplicated route maps (product.md §3.6, frontend.md FA-06) |
| D3 | **`/events` is the 活动 column**, defaulting to 本周末. Segments: 本周末 \| 日历·地图 (`/calendar`, kept as the URL through R1) \| 免费与优惠 \| 新店<br>Legacy URLs:<ul><li>`/this-month` becomes an alias</li><li>`/this-week` gets a server 301 to `/events` with the query preserved. If Vercel `routes` cannot carry the query, it becomes an alias with canonical `/events`</li><li>`/n/{region}` gets a 302 to `/events?region=$1&from=card-$1`</li></ul> | PROD-02. Keeps the opus test's client-side `/calendar` link and the 3D deep links alive |
| D4 | **Keep the phone top-bar `•••` (更多) panel.** Do not move it into `/me` | The opus test requires `SiteNavigation` to render `a[href="/opus-bay?from=nav"]` (`tests/opus-bay-w9-e-switch.test.tsx:84-93`) |
| D5 | **Aa = root rem scaling**, plus `public/reading-init.js` applied before first paint. The same PR pins `--reading-scale:1` and deletes `tokens.css:19-20` | design.md TL;DR #5–6, READ-05 |
| D6 | **UI primitives live in `src/components/ui/`** (the existing directory) and import their own `ui.css`. **No new global CSS import in `src/main.tsx`** until WEB-CSS-PRUNE | Avoids hot-file conflicts. Legacy cascade stays untouched until the prune |
| D7 | **One cover resolver, `getCover(item, ctx)`, plus `<TypeCover>`.** Honesty ladder: official image with rights → PD/CC ≤8 years with `coverOk` → approved venue photo ≤8 years → 3D postcard (SF places only) → TypeCover<br>Labels come only from `getImageProvenance()`: 官方图 / 照片 · 年份 / 资料图 · 年份 / BAYLINK 实拍 · 日期 / AI 插图 (series art only) / 3D 场景插图 / BAYLINK 信息卡<br>Badge: top-left, 13 px | 1007 §5.3; design.md §1.2, §4.6; content.md §4.1 | **Superseded 2026-10-21 (UI9-IMAGES DECISIONS 21–27, owner):** no `<TypeCover>` / information card on any card, row, hero or share image; every cover is a picture (① own → ② venue → ③ category stock 示意图 → ④ approved AI 示意图); a failed file falls back to a ③ picture, then the LQIP colour.
| D8 | **Image pipeline**: 480/800/1200 WebP plus a dominant-colour LQIP manifest. Built with a `sharp` devDependency in a script run by the lane; outputs are committed and CI only verifies them. This is a reversible judgement call and is flagged to the owner | quality.md §2.1, FA-14 |
| D9 | **Browse feeds**: two columns, 173 px cards, 3:4 covers (offers and posts 1:1), one 4:5 hero per feed. They switch automatically to one column at 大/特大 text (3:2 covers). **办事 pages stay quiet**: key facts, contact cards and diagrams, no mood photos | 1007 §5.4, §5.2 |
| D10 | **Phone detail pages** (`/events/:id`, `/offers/:id`, `/openings/:id`): the tab bar is **replaced** by one 64 px action bar: ♡ 想去 · 加入行程 · 问 BayBay (the otter, opens with the page capsule) · 官方页 ↗. The header shows "‹ 活动" | Saves 64 px of chrome versus stacking two bars, and keeps BayBay one tap away (resolves design.md §4.9) |
| D11 | **Freshness shown to readers follows source state, not the calendar.**<ul><li>manual-required and error sources are never shown to readers</li><li>Haiku triage auto-acknowledges cosmetic diffs, logged as `auto-triage` and never shown as human review</li><li>Trust row: "✓ 官方来源 · 编辑核对 9/29 · 自动比对 10/7 无变化"</li></ul> | content.md §4.5. Without triage, G8 fails for offers (20%) and guides (33%) |
| D12 | **`verifiedAt` is human-only.** Agents never bump it. Agent source reads go into a ledger, `docs/source-reads-2026-10.md` (URL, date, quote) | docs.md §2.7 |
| D13 | **BayBay model routing.** A deterministic router sends roughly 80% of traffic down a **single-call fast path on Haiku 5.5** (the owner authorised the switch)<ul><li>Escalations, 办事/professional topics and plans use **Sonnet 5.5**</li><li>Native web search stays on Sonnet/Opus until a test call proves it works on Haiku</li><li>Opus 5.5 is used only for content batches and as the eval judge</li><li>If the Haiku-low eval misses the bar, try Haiku-medium, then Sonnet-low as the default</li></ul> | baybay.md §2–§3 (H1–H15) |
| D14 | **Real provider streaming** with a lead-first schema (`lead` ≤40 字). New SSE event `draft`; `result` remains authoritative | ENGINE-06, FA-17 |
| D15 | **Eval gates every BayBay change.** The eval runs locally with a separate key, a fixed `now` and an in-memory quota. It never touches production quotas or Mongo | ENGINE-07, 1007 §6.5 |
| D16 | **Analytics**: a self-hosted route-template dimension ships regardless. Vercel Web Analytics + Speed Insights is recommended (cookieless, same-origin, CSP-safe) and is an owner toggle | quality.md §5 |
| D17 | **Language memory**: a saved zh-Hant/en preference is honoured on neutral URLs through a client-side replace to the prefixed URL. SEO is unaffected | E2E-07 |
| D18 | **Generated files** stay tracked but are never hand-edited. They are regenerated in one final commit after the last rebase. `generatedAt` is removed from `home-catalog.json` | FA-05 |
| D19 | **One save model**: ♡ 收藏, covering event, place, guide, **offer** and **opening**. Server favorites when logged in, local storage for guests. "加入这天计划" saves immediately | G15 |
| D20 | **Community honesty**: 邻里信息（测试中）. 发布 appears only inside 邻里. No fabricated posts or counts; counts under 3 are hidden. Owner seed posts are labelled 站长发布 | G16, PROD-09 |
| D21 | **Home H1**: "这个周末，湾区去哪？" (display 28/36). The live subtitle carries the "怎么办" half: "63 场活动 · 141 篇办事指南 · 每条附官方来源，10/7 核对" | product.md §1.1. The owner may override the wording only |
| D22 | **Guide taxonomy = 7 task topics** as a mapping layer (`src/data/guide-topics.ts`). Data categories are not rewritten. Topics: 长辈与家属 first · 医疗保险 · 证件与移民 · 住房 · 出行 · 省钱福利 · 周末出游. Schools go under 新来安顿 copy; 防骗 is a cross-tag | product.md §8 #2 |
| D23 | **Freezes and cut lines**<ul><li>No user-visible web merges during R0 sessions (10/10 06:00 → 10/12 22:00 PT), hotfixes excepted</li><li>Wave 3 cut line: 10/18 12:00 PT</li><li>R1 (10/19–11/15): only fixes for what testers hit</li></ul> | 1007 §9.2 |
| D24 | **The route data split (FA-01) is a stretch goal** and is not needed to reach 8 | Engineering carries 4% of the weight; the split is L-sized and risky |
| D25 | **Posters and official artwork are never cropped** (blur-fill letterbox). Photos are cropped by `focal` | docs.md §5 #5 |
| D26 | **Opus Bay boundary.**<ul><li>Never edit `src/opus-bay/**`, `tests/opus-bay-*`, `vite.opus.config.ts` or `vite.config.ts` `manualChunks`</li><li>`public/opus-bay/**` is reference-only (the postcards)</li><li>The OPUS contract in §3.0 is mandatory</li></ul> | docs.md §2.10 |

---

## 1. Product brief and target IA (one page)

**Purpose.** "湾区去哪、怎么办 · 有来源的中文答案". English: "Where to go and how to get it done in the Bay — with sources".

BAYLINK answers two questions for Chinese-speaking Bay Area families: **this weekend / today, where to go**, and **how to get a task done**. Every answer carries an official source and a check date. The moat sits where Xiaohongshu shows author and likes: "✓ 官方来源 · 核对 10/7".

**Audiences**, in R1 mix order:

| Audience | R1 share | Core job | Must-not-fail path |
|---|---|---|---|
| Family organiser, 30–55 | 6 | This weekend, near home, free or kid-friendly; save it; send to the family group | Home cover → detail → 存日历 / 发到家庭群 |
| Newcomer (<2 years) | 6 | DMV, Medi-Cal, SSN, renting, schools | 指南 topic → 30 秒看懂 → official entry |
| Senior 60+ (2 solo, 3 assisted) | 5 | Senior services, Medicare/HICAP, free Muni; call a number; large text | 长辈与家属 hub → tel → 发给家人 (`?reading=extra-large&simple=1`) |
| Visiting relative or tourist | 3 | A car-free day; this weekend's big event (Fleet Week) | Search 蓝天使 → detail with times, place and cost |
| Local poster | Dormant | Rent, used goods, services; DMs | 我的 → 消息; 发布 only inside 邻里 |

**Promises the UI must keep.**
- Image-first and honestly labelled.
- Decision facts (date, price, source) sit on the image.
- No fake engagement.
- Tap-to-call everywhere.
- Text size works before first paint.
- BayBay knows the page you are on and answers in about 3 s.

**Anti-goals.**
- No AI picture that looks like a real scene, venue, dish or product.
- No image-heavy 办事 pages.
- No invitations into empty community spaces.
- Not a classifieds site, social network or city game (the 2026-07 iOS blueprint is obsolete).

**Target IA** (from product.md §4.2–4.4 with D3/D4/D10 applied):

```
Phone bottom bar: 首页 / · 活动 /events · [otter] 问 BayBay (panel) · 指南 /guides · 我的 /me (unread badge)
Phone top bar: logo · search · 字号(Aa) · 简/繁/EN · •••(更多)
Desktop header (1216): logo · 首页 · 活动 · 指南 · 问 BayBay · 更多▾ … search(⌘K) · 字号 · 语言 · avatar menu (消息 n · 我的这周 · 设置 · 退出) — no "+ 发布信息"

首页 /            H1 这个周末，湾区去哪？ + live subtitle; 9 sections (1007 §4.2)
活动 /events      [本周末 | 日历·地图 (/calendar) | 免费与优惠 (?view=perks) | 新店 (?view=openings)]
                  chips: 地区(remembered) 免费 亲子 长辈友好 户外 演出 市集 下雨也行 有人同行 科技/AI
  /events/:id /offers/:id /openings/:id   hero-first detail, action bar (D10)
  /together(?outing=)                     via chip 有人同行, detail, 我的
  legacy: /this-week→301 /events · /this-month alias · /n/{region}→302 /events?region&from=card-*
问 BayBay (panel; bottom sheet / right drawer) — 行程 /plan is its workspace (rename to 行程 now; merge post-R1)
指南 /guides      topics: 长辈与家属 · 医疗保险 · 证件与移民 · 住房 · 出行 · 省钱福利 · 周末出游 (+ region row)
  /guides?topic=elders  shareable 长辈 hub
  /guides/:slug         看 (carousel) → 查 (30 秒看懂 + 联系卡) → 读 (steps + sources)
  /explore /tools       secondary links under 周末出游 / 指南 header
我的 /me          2×2: 消息(n) · 我的这周 · 我的发布 · 小队与预约; settings: 字号与简洁显示 · 语言 · 通知 · 隐私与账号 · 反馈
  /messages(/:id) /my-week /me/bookings
更多 (•••)        消息 · 我的这周 · 邻里信息（测试中） · 按地区找景点 · 生活工具箱 · 3D 旧金山 (/opus-bay?from=nav) · 关于与核验方法 · 反馈与报错 · 条款/隐私/短信
Global footer     关于与核验方法 · 反馈 · 内容目录 /archive · 条款 · 隐私 · 短信说明 (13 px, 44 px targets)
Retire            /recommend: inbound links removed now; 301 after R1 (owner)
```

**Naming table.** Applied by every lane, per product.md §4.5.

| Concept | Name |
|---|---|
| Events column | 活动 |
| Weekend view | 本周末 |
| Plan | 行程 |
| Save | 收藏 / ♡ 想去 |
| Squads | 一起去 |
| Assistant | 问 BayBay |
| Week view | 我的这周 |
| Board | 邻里信息（测试中） |
| Peninsula | 半岛 |

Banned in the UI: 月刊, 湾区生活手记, BAYBAY 智能出游计划, 我的收藏与计划. English all-caps eyebrows are allowed only under `/en`.

---

## 2. Scorecard: current → target, with deliverables and audit evidence

Weights are the 1007 rubric's. The plan targets **8.2 weighted** (8.165 exactly). The **floor** column is the lowest acceptable score for each dimension, assuming the other dimensions hit their targets.

| Dimension | W | Now | Target (floor) | Deliverables that move it (lanes) | What the re-auditor checks |
|---|---|---|---|---|---|
| 产品定位与战略 | 10% | 5.5 | **8.5** (8.0) | <ul><li>Positioning sentence on all 8 surfaces (WEB-QUICK: manifest, index; WEB-ACCOUNT: /me; WEB-SHELL2: footer; WEB-BB-UI: panel header; WEB-SECONDARY-B: About)</li><li>Home H1 plus a subtitle carrying both halves (WEB-HOME)</li><li>Editor picks every Thursday (a3 + owner)</li><li>Feedback entry (WEB-FEEDBACK)</li><li>No empty-community prompts (WEB-SHELL1, WEB-COMMUNITY)</li></ul> | Grep and screenshots of title, meta, manifest, About, footer, /me and BayBay header; home first screen at 390; PROD-01/05/10 closed |
| 信息架构与导航 | 8% | 5.5 | **8.5** (8.0) | <ul><li>`/events` column (WEB-ROUTES, WEB-EVENTS)</li><li>Legacy 301/302 with query preserved (WEB-ROUTES)</li><li>Landing parity for the share card (WEB-EVENTS, WEB-SHARE-SEO)</li><li>Inbox ≤2 taps (WEB-SHELL1, WEB-ACCOUNT)</li><li>0 orphan task routes (route-table test)</li><li>Naming table applied</li><li>Search synonyms (WEB-ELDERS)</li><li>Prerender nav equals app nav (WEB-QUICK, WEB-SHELL2)</li></ul> | `journey.mjs`: 12 tasks at ≤3 taps and ≤1.5 screens on phone, 0 blocked. `tests/route-table.test.ts`. curl of the legacy URL list. `/n/all` first-screen ids equal `/weekly/all.png` ids |
| 视觉与高级感 | 10% | 5.5 | **8.5** (8.0) | <ul><li>Tokens v2 (WEB-TOKENS)</li><li>Primitives (WEB-UI)</li><li>All 20 templates migrated: W1 ACCOUNT, SAVES; W2 HOME, EVENTS, DETAIL, GUIDES, BB-UI, SHELL2; W3 COMMUNITY, PLAN, SECONDARY-A/B</li><li>Ratchet and stylelint (WEB-GUARDS, WEB-CSS-PRUNE)</li></ul> | SYS probe on 20 templates. Each must have ≤10 text colours, ≤5 button styles, ≤3 card styles, a single H1 spec, 0 zh English eyebrows, 0 internal ↗ and weights only 400/600/700. Screenshots at 1440 and 390 in 3 locales |
| 手机、无障碍与适老 | 8% | 6.0 | **8.5** (8.0) | <ul><li>Root Aa plus `reading-init.js` and 简洁显示 (WEB-TOKENS)</li><li>`tel:` chips (WEB-ELDERS, mounted by DETAIL and GUIDES)</li><li>长辈与家属 entries (HOME, GUIDES, `guide-topics`)</li><li>Automatic single column (WEB-UI FeedGrid)</li><li>Contrast and target fixes in every template lane</li></ul> | READ probe: 特大 growth ≥95% (titles 100%); <12 px ≤2%; AA fails ≤2%. `tel:` count equals the phone-string count on the 7 pillars plus the senior guide. Aa size correct at first paint. T5 ≤3 taps |
| 内容时效与准确 | 7.5% | 6.0 | **8.0** (7.5) | <ul><li>Source-state reader rule (WEB-FRESH)</li><li>Haiku triage, digest and fields (API-FRESH-TRIAGE)</li><li>Admin queue (WEB-FRESH-ADMIN)</li><li>48 h editor SLA (owner/GPT)</li><li>November supply line (GPT, plus the advisory gate)</li><li>Ended events: noindex after 30 d and leave the sitemap after 7 d (WEB-SHARE-SEO)</li></ul> | Crawl of live detail pages: share showing any prompt ≤10% (G8). 0 reader-visible pipeline jargon. Coverage report: ≥5 events per region for each of the next 4 weekends |
| 编辑质量与覆盖 | 7.5% | 5.5 | **8.0** (7.5) | <ul><li>Structured event facts, `shortTitle`/`dek`, and removal of boilerplate, duplicate lines and internal notes (CNT-EVENTS)</li><li>Pillar 30 秒看懂, contacts, carousels and fact diagrams (CNT-GUIDES + WEB-GUIDES)</li><li>Editorial lints</li></ul> | `audit-editorial-content`: 0 boilerplate, 0 date/cost duplicate lines, 0 internal-note terms. Pillar hedging ≤12 per 1k chars. A 27-item accuracy re-check still yields 0 wasted trips |
| 多语言 | 5% | 6.0 | **8.0** (7.5) | <ul><li>Language memory (WEB-SHELL1)</li><li>UI-literal English ratchet down to 0 on task pages (WEB-GUARDS + lanes)</li><li>EN H1 space and zh-Hant user bubble (WEB-QUICK)</li><li>zh-Hant normalisation in search (WEB-ELDERS)</li><li>BayBay D block (eval)</li></ul> | `/en` first paint has no CJK. Ratchet count. A reopened `/` remembers zh-Hant. Eval D block passes |
| BayBay 架构 | 7.5% | 5.0 | **8.5** (8.0) | <ul><li>Per-route models, pricing, metrics and $ ledger (API-BB-MODELS)</li><li>Router, fast path, caching, dedupe and retrieval (API-BB-ENGINE)</li><li>Streaming (API-BB-STREAM + WEB-BB-STREAMPREP)</li><li>Helpers on schemas (API-BB-HELPERS)</li><li>Caps, pause mode and cut-over (API-BB-CUTOVER)</li><li>Eval harness (API-BB-EVAL)</li></ul> | Eval report on the deployed commit. ai-metrics shows a model split and `cacheReadTokens` > 0. `costMicroUsd` matches usage × price within 1%. Unit tests |
| BayBay 回答质量 | 7.5% | 5.0 | **8.5** (8.0) | <ul><li>Guardrails and page context (API-BB-GUARD)</li><li>Retrieval recalls and aliases (API-BB-ENGINE)</li><li>Answer layout with image cards, ≤250 字 and no login pitch (WEB-BB-UI)</li></ul> | 64-item eval: false negatives ≤5%, 0 safety misses, judge mean ≥7.5, lead p50 ≤3 s, complete p50 ≤6 s (fast path), ≥80% of recommendation answers carry image cards. Live re-probe of the 30 BBLIVE questions: mean ≥7.5 (was 5.32) |
| 功能联动 | 6% | 5.5 | **8.0** (7.5) | <ul><li>One save model including offers, plus AddToDayPlan (WEB-SAVES + API-FUNC)</li><li>Page entity handed to BayBay</li><li>Card ♡ and 加入行程 in answers</li><li>Squad list on the event panel (WEB-DETAIL)</li></ul> | E2E t6/t11: an offer can be saved, the /me count equals the My Week count, and add-to-day persists |
| 社区与交易 | 6% | 4.5 | **7.0** (6.5) | <ul><li>G1, G2 (API-ACCOUNT), G4/N3 (WEB-SHELL1), G16</li><li>N2 notification timing, comment topic (API-NOTIFY-SEC)</li><li>System-notice cards (WEB-ACCOUNT)</li><li>T15/T20 restyle (WEB-COMMUNITY)</li><li>Owner G5 checks and seed posts</li></ul> | E2E 46 steps: 0 FAIL, ≤3 UX-ISSUE. G5 owner checklist signed. ≥8 real posts visible |
| SEO、分享与增长 | 6% | 5.5 | **8.0** (7.5) | <ul><li>Sitemap with `/events` and x-default; `?lang` 301; Permissions-Policy (WEB-ROUTES)</li><li>Rich JSON-LD, hub OG 1200×630, share card v2 (WEB-SHARE-SEO)</li><li>Route analytics (WEB-FEEDBACK)</li><li>apex 308 and Search Console (owner)</li></ul> | `verify-release` SEO checks. Owner Rich Results test: 0 errors. curl head parse on 12 routes × 3 locales |
| 工程与性能 | 4% | 5.5 | **8.0** (7.5) | <ul><li>SiteChrome, no blank frame, boot-failure render (WEB-SHELL2)</li><li>`reading-init` (WEB-TOKENS)</li><li>Image ladder and LQIP (WEB-IMAGES)</li><li>Per-route budgets and ratchets (WEB-GUARDS)</li><li>Global CSS ≤60 KB gz (WEB-CSS-PRUNE)</li><li>Error beacon (WEB-FEEDBACK); 5xx logs (API-ACCOUNT)</li><li>Data split (stretch)</li></ul> | `perf-cold.mjs`: home LCP ≤2.5 s, `topbarAt` ≤ FCP + 50 ms, no blank-main frame, home TBT ≤300 ms. CI budget table |
| 安全与隐私 | 4% | 5.0 | **8.0** (7.5) | <ul><li>A1 activated plus canary (owner)</li><li>G2 and SEC-14 (API-ACCOUNT)</li><li>SEC-08/09/N6 (API-NOTIFY-SEC)</li><li>$ caps (API-BB-CUTOVER)</li><li>Privacy policy names Anthropic (N1, WEB-FEEDBACK)</li><li>Permissions-Policy (WEB-ROUTES)</li></ul> | Canary PASS rows; tests; `curl -I` headers; privacy text |
| 3D 世界的整合价值 | 3% | 5.0 | **7.0** (6.5) | <ul><li>Home 3D key-art tile from the postcards (WEB-HOME)</li><li>SF place covers from postcards labelled "3D 场景插图" (WEB-UI resolver tier 4, WEB-SECONDARY-A)</li><li>Untruncated `opus_*` route analytics (A1 + WEB-FEEDBACK)</li></ul> | Home tile, /explore cards, route metrics |
| **Weighted** | 100% | **5.4** | **8.2** (≥8.0) | | Same 15 weights. Margin over 8.0 is about 0.16 |
| *图文结合* (unweighted, must be ≥8) | — | 4.0 | **8.0** | <ul><li>TypeCover on 100% of events, offers and openings without a real image</li><li>`getCover` everywhere</li><li>Hero on every detail page</li><li>Guide carousels and diagrams</li><li>BayBay image cards</li><li>Same-page de-duplication and LQIP</li><li>Real photos added (CNT-MEDIA)</li></ul> | capture2 image area: home ≥0.45 phone / ≥0.35 desktop; events weekend ≥0.45; calendar ≥0.15; guides index ≥0.30; detail hero on the first screen 100%. Longest image-free stretch ≤1 screen on browse pages. ≥4 real photos in the first 8 event cards. 100% of factual cards have a cover | **UI9-IMAGES (2026-10-21):** the target is 0 information cards and 100% picture covers, reported per page by tier (report:covers).
| *功能走通* (unweighted, must be ≥8) | — | 5.5 | **8.0** | All R1 functional gates | E2E harness: 0 FAIL. Owner G5 |

Weighted arithmetic at target: 8.5×51% (定位, IA, 视觉, 手机, BB 架构, BB 质量) + 8.0×40% + 7.0×9% (社区, 3D) = 4.335 + 3.2 + 0.63 = **8.165**.

**How the floors work.** Each floor assumes the other dimensions hit their targets. The total stays ≥8.0 with **up to three** dimensions at their floors; the worst three-way case is 8.165 − 0.05 − 0.05 − 0.04 = 8.025. If four or more dimensions land at their floors, add a hotfix wave before telling the owner.

---

### 3.0 Global lane rules, contracts and hot-file ownership

#### Rules (every lane)

1. **Worktree.**
   - Run `git -C C:/Users/willy/OneDrive/Desktop/baylink-web fetch origin`, then `worktree add C:/Users/willy/wt/claude-<lane> -b claude/<lane> origin/main`, then `npm ci`. The api repo works the same way.
   - No `node_modules` junctions.
   - Never work in, reset or stash the owner's checkouts. Never touch `.codex/worktrees/*` or `baylink-opus`.
2. **Opus Bay.**
   - Never edit `src/opus-bay/**`, `tests/opus-bay-*`, `vite.opus.config.ts`, or `vite.config.ts` `manualChunks`.
   - `public/opus-bay/**` is reference-only.
   - Run `npm run test:opus` whenever a lane touches `App.tsx`, `prerender.tsx`, `vite.config.ts`, `src/i18n/*`, `SiteNavigation`, `HomeDiscovery` or `AttractionExplorer`.
3. **Generated files are never hand-edited.** After the final rebase, run `npm run pretest` (and `npm run build` when public exports change) and commit "Regenerate generated files" as the last commit. This covers:
   - `src/data/generated/**`
   - `vercel.json`
   - `public/sitemap.xml`
   - `public/*catalog*.json`
   - `public/baybay-guides*.json`
4. **Copy.**
   - New UI copy goes through co-located `t(zh, en)`. Editorial data goes through dictionary packs with en entries.
   - zh-Hant is runtime OpenCC; user text is wrapped in `translate="no"`.
   - The `/en` shell must contain no CJK.
5. **Styles.**
   - New CSS lives in lane-owned namespaced files imported by the lazily loaded component.
   - Use tokens and rem only. Weights are 400/600/700. No hex outside `tokens.css`.
   - Text is ≥13 px on phone. Tap targets are ≥44 px (48 in simple mode).
   - Add every new file to `editorialStyleScopes`.
   - **Delete the legacy rules you replace** and run `npm run ratchet:update`, which can only lower counts.
6. **Images.**
   - Render only through `<CoverImage>`/`getCover`. Take labels only from `getImageProvenance`.
   - No AI images on events, offers or openings, and no AI edits to photos.
   - Same-page de-duplication.
   - A new image needs `rights.basis` (record shape from a4 `federal-pd-media.json`).
   - Downloads need owner approval per the §6 list.
7. **Data honesty.**
   - Never change `verifiedAt`. No new facts without a ledger entry.
   - No fake counts; hide counts under 3.
   - Model output is a draft; a second agent verifies it before merge.
8. **Budgets.**
   - Home route graph ≤220 KiB (never raised; target ≤212).
   - Per-route ceilings only ratchet down.
   - Image budgets from WEB-IMAGES.
   - No inline scripts and no third-party script hosts (CSP).
9. **Tests.**
   - Convert the tests you touch to role/testid queries. No snapshot tests.
   - Each lane updates its own tests.
   - Locally, `npm run check` must be green (web) and `npm test` must be green (api).
10. **Screenshots.**
    - Build with `npm run build`, serve with `npx vite preview --port 4173`, then run capture2 (or a copy taking a base-URL argument).
    - Viewports: phone 390×844 and desktop 1440×900, in zh-Hans, zh-Hant and en.
    - Template lanes add phone 特大 and phone 简洁显示 (zh-Hans).
    - Store before/after under `C:/Users/willy/opus-qa/overhaul/shots/<lane>/{before,after}/<lang>/<phone|desktop>/<page>[-xl|-simple].png` and list them in the PR.
11. **PR.**
    - One lane is one PR (a lane may ship 2–3 sequential PRs).
    - English commit messages, plus a Chinese "改了什么 / 怎么证明 / 还剩什么" block in the PR body.
    - End commits with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
    - Enable auto-merge only after local check passes.
    - **API merges before any dependent web merge.**
12. **Production.**
    - No logins, posts, DMs or emails on production.
    - Live BayBay calls only within the owner-approved budget (§6).
    - No audit or capture runs during the A1 canary or tester sessions.
    - Block `/api/product-events` in every scripted browser run.

#### OPUS contract (breaking any item fails CI's `opus` job)

These must stay true at every merge:
- `HomeDiscovery` keeps `a[href="/opus-bay?from=home"]`:
  - its text matches /3D 旧金山/ and /独立 3D 体验/ (en /3D San Francisco/)
  - it navigates with a full-page load
  - there is no `/play` link
- `HomeDiscovery` keeps a **client-side `<Link to="/calendar">`**, added as "按日历看" by WEB-ROUTES and kept by WEB-HOME.
- `HomeDiscovery` keeps its props (`onAskBayBay`, `onBrowseCommunity`, `today`).
- `SiteNavigation` keeps `a[href="/opus-bay?from=nav"]` with the text "3D 旧金山" and `aria-current="page"` on `/opus-bay` and `/play`, and still accepts the props used in the test (`active`, `category`, `homeActive`, `user`, `notification`, `notificationCount`, `onCreate`, `onAsk`, `onAccount`).
- `src/App.tsx` keeps exactly `<Route path="/play" element={<PlayRedirect />} />`.
- `scripts/prerender.tsx` keeps the `play.html` writeFile line, and `'/play'` stays out of sitemap paths.
- `AttractionExplorer` keeps its 3D entry (`tests/opus-bay-attraction-entry.test.tsx`).

#### Web ↔ API contracts

APIs are always additive. Old clients must keep working.

| Contract | Shape | Producer → consumer |
|---|---|---|
| SSE `draft` | `{seq, field:'lead'\|'point', index?, text}`, appended in order. `result` replaces the draft. Unknown events are ignored | API-BB-STREAM → WEB-BB-STREAMPREP / WEB-BB-UI |
| Answer fields | `lead` (≤40 字), `points[{text, cardIds[]}]`, `followups[]`, `safety{kind:'emergency'\|'professional', topic}`, `pageEntity{kind,id,title}`. The legacy `answer` string stays | API-BB-ENGINE → WEB-BB-UI |
| Favorites | `PUT/DELETE /api/planner/favorites/:kind/:id`, with kind ∈ event, place, guide, offer, opening. Unknown id → 404 | API-FUNC → WEB-SAVES |
| Feedback | `POST /api/feedback {kind:'page'\|'content'\|'baybay', routeTemplate, reason, text≤500, contact?≤80, entity?{kind,id}, locale, readingSize, release, website(honeypot)}` → 202. Rate limits: 10/day per visitor key, global 500/day | API-FUNC → WEB-FEEDBACK |
| Product events | `POST /api/product-events {event, locale, route?}`. `route` is in a ~25-entry allowlist, otherwise `other`. Payloads without `route` are still accepted. Separate limiter | API-FUNC → WEB-FEEDBACK |
| Client errors | `POST /api/client-errors {kind:'render'\|'error'\|'rejection'\|'chunk', route, release, fp}`. Daily aggregates; no stacks or URLs | API-FUNC → WEB-FEEDBACK |
| Freshness | `GET /api/sources/freshness` items gain `changedAt`, `material`, `changeFields[]`, `lastReviewedAt`, `reviewedBy:'auto-triage'\|'editor'` | API-FRESH-TRIAGE → WEB-FRESH (handles their absence) |

#### Hot files: owner and serial order

No other lane edits these files. Other lanes mount components or pass context instead.

| File | Order of lanes allowed to edit |
|---|---|
| `src/tokens.css` | WEB-TOKENS → WEB-CSS-PRUNE |
| `src/design.css` | WEB-QUICK (weights) → WEB-TOKENS (codemod) → WEB-COMMUNITY (delete `.bay-category-*`) → WEB-CSS-PRUNE |
| `src/main.tsx` | WEB-SHELL2 (boot) → WEB-CSS-PRUNE (imports) |
| `index.html` | WEB-QUICK → WEB-TOKENS (`reading-init` tag) |
| `src/App.tsx`, `src/route-loaders.ts`, `src/routing.ts`, `src/lib/ui-navigation.ts`, `scripts/sync-public-routes.ts` | WEB-ROUTES only |
| `scripts/prerender.tsx` | WEB-QUICK (nav label fix) → WEB-ROUTES → WEB-SHELL2 |
| `scripts/verify-release.mjs` | WEB-GUARDS → WEB-ROUTES → WEB-SHARE-SEO → WEB-CSS-PRUNE → WEB-DATA-SPLIT |
| `scripts/generate-sitemap.ts` | WEB-ROUTES → WEB-SHARE-SEO |
| `package.json` | WEB-GUARDS → WEB-IMAGES → WEB-CSS-PRUNE (stylelint) |
| `src/i18n/locale.ts` | WEB-SHELL1 (lines 126–137) → WEB-HOMEPREP (lines 184–188) |
| `scripts/english-sources.json` | CNT-EVENTS → CNT-GUIDES. Append-only; UI lanes use `t()` and do not touch it |
| `src/app/AppLayout.tsx`, `src/app/context.ts` | WEB-SHELL1 → WEB-SHELL2 |
| `src/components/SiteNavigation.tsx`, `SiteMobileNavigation.tsx` | WEB-ROUTES (hrefs) → WEB-SHELL1 → WEB-SHELL2 |
| `src/components/HomeDiscovery.tsx` | WEB-QUICK → WEB-ROUTES (one link) → WEB-HOME |
| `src/pages/HomePage.tsx` | WEB-HOMEPREP → WEB-HOME. WEB-COMMUNITY owns the new `CommunityBoard.tsx` instead |
| `src/components/LocalDiscoveryDetail.tsx` | WEB-FRESH → WEB-QUICK → WEB-DETAIL |
| `src/components/GuideDetail.tsx` | WEB-FRESH → WEB-QUICK → WEB-GUIDES |
| `src/data/guide-media.ts` | WEB-IMAGES only. CNT-MEDIA uses `media-rights-overlay.json` |
| `src/data/monthly-edition.ts`, `october-offers.ts`, `local-discoveries.ts` | CNT-EVENTS: one overlay hook line each, applied last |
| `src/lib/image-provenance.ts` | a2 → WEB-UI |
| api `server.js` | API-BB-GUARD (middleware list) → API-ACCOUNT (handler, async wraps) → API-FUNC (mounts) → API-NOTIFY-SEC (auth, comments) → API-BB-HELPERS (post-assist) → API-BB-STREAM (SSE) |
| api `lib/baybayAgent.js` | API-BB-GUARD → API-BB-ENGINE → API-BB-STREAM (stacked) → API-BB-CUTOVER |
| api `lib/anthropicBaybay.js` | API-BB-MODELS → API-BB-ENGINE → API-BB-STREAM |
| api `lib/anthropicJson.js`, `anthropicWebSearch.js` | API-BB-MODELS → API-BB-HELPERS |
| api `lib/notifications.js` | API-ACCOUNT (N5) → API-NOTIFY-SEC |

Codemods (weights, internal ↗, eyebrows, px→rem) are committed scripts under `scripts/codemods/`. After a rebase, re-run the script instead of resolving conflicts by hand.

---

## 5. Verification and re-audit protocol

### 5.1 When and who

- **Pre-audit**, 10/17 PM after Wave 2: the automated set only.
- **Full re-audit**, 10/18 PM after the Wave 3 cut line.

The full re-audit mirrors 1007:
- **13 lens agents:** HOME, SYS, EVT, GUIDE, VISUAL, READ, CNT, BBLIVE, ENGINE, E2E, REG, PROD, plus QUALITY/PERF.
- **Cold context.** Lens agents may read the 1007 report and the live site, but **not** lane PR bodies or this plan's lane sections before scoring.
- **Second check.** Every finding is re-checked by a second verifier agent.
- **Scoring.** One scoring agent applies the 15 weights.

### 5.2 Automated measurements and pass thresholds (production unless noted)

| Tool | Scope | Pass |
|---|---|---|
| `capture2.mjs` (imageStats, fonts, targets) | ~45 pages × phone/desktop × 3 locales, plus phone 特大 and simple mode on 10 templates | Home image area ≥0.45 phone / ≥0.35 desktop; events weekend ≥0.45; calendar ≥0.15; guides index ≥0.30; detail hero on screen 1 for 20/20 sampled; longest image-free ≤1 screen on browse pages; <12 px ≤2% on all templates; 0 same-screen duplicate images |
| `work/SYS/probe.mjs` | 20 templates | ≤10 text colours, ≤5 button styles, ≤3 card styles, 1 H1 spec, 0 zh English eyebrows, 0 internal ↗, weights 400/600/700 only |
| `work/READ/probe.mjs` + `run1.mjs` | 20 templates, 特大 | Growth ≥95% (titles 100%); AA fails ≤2%; `tel:` coverage 100% on 7 pillars, the senior guide and SFMTA; no non-inline target <24 px; primary actions ≥44 |
| `work/PROD/journey.mjs` | 12 tasks, phone | All ≤3 taps and ≤1.5 screens; 0 blocked |
| E2E harness `work/E2E/t*.mjs` (local full stack on the deployed commits) | 46 steps | 0 FAIL, ≤3 UX-ISSUE |
| BayBay eval (local, eval key, deployed api commit) | 64 + 12 helper items | Code gold ≥ Opus-optimised − 2; false negatives ≤5%; 0 safety misses (including degraded); judge mean ≥7.5; lead p50 ≤3 s; complete p50 ≤6 s fast path / ≤12 s plans; ≥80% of recommendation answers have cards; $/q ≤$0.02 blended; `cache_read` > 0 on second agent calls |
| BBLIVE live re-probe (production; owner-approved ≈ $1–2 including judge) | The same 30 questions as 10-07 | Mean ≥7.5 on the same rubric (was 5.32); quick cards ≤3 s; no 登录 pitch |
| `perf-cold.mjs` (`understand/_perf`) | `/`, `/events`, `/calendar`, `/guides`, a guide detail, an event detail; zh-Hans + `/en/` | Home LCP ≤2.5 s; `topbarAt` ≤ FCP + 50 ms; `blankMainAt` null; home TBT ≤300 ms; JS within the CI ceilings; first-paint Aa equals the final size |
| `verify-release` + curl head parse | 12 routes × 3 locales | Canonical, hreflang, x-default, OG 1200×630 on hubs, Event/Article fields, `Permissions-Policy`, legacy URL statuses with query preserved |
| Content | Crawl of live details; `audit-editorial-content`; `report:content-coverage` | Prompt shown ≤10%; 0 lint errors; ≥5 events per region per weekend for the next 4 weekends (advisory, reported) |
| Security | A1 canary output; api tests; `curl -I` | Canary PASS rows; headers present |

**Scoring rule.**
- **Pass:** weighted ≥8.0, 图文结合 ≥8, 功能走通 ≥8, no dimension below its floor and at most three at their floors (§2), 0 open P0, and ≤5 open P1.
- **If the re-audit fails:** it lists the deficit per dimension, and hotfix lanes target the largest weighted gaps before the owner is told.

### 5.3 Production bug hunt (read-only; product-events blocked; not during the canary or tester sessions)

1. **Sitemap crawl** of every URL (about 2,700):
   - expected status (200, or 301/302 for legacy URLs), HTML present, header and footer present
   - 0 unexpected 404s and 0 broken image requests
2. **Headless Chrome sweep** of 120 pages (40 per locale) × phone and desktop:
   - 0 console errors
   - no horizontal overflow at 320 and 390 (`scrollWidth` > `clientWidth`)
   - no `[ErrorBoundary]` logs
3. **Interaction sweep:** every nav item, segment, chip, sheet, carousel (keyboard), ♡ (guest), add-to-day, share, Aa ×3, simple mode, language switch and memory, BayBay open/close, page capsule, feedback sheet (dry run against local api).
4. **Legacy URL list:** `/calendar`, `/this-month`, `/this-week?region=sf&from=card-sf`, `/n/{6}`, `/plan?stops=…`, `/my-week`, `/play`, `/opus-bay`, `/recommend`, `/category/*`, `/posts/:id` (back stays in-site), `/users/:id`.
5. **Resilience:** chunk-404 injection, API blocked (error states render, no blank page), BayBay pause mode (local env).
6. **Adversarial BayBay set, local:** 5 emergency, 5 professional, 3 injection, 3 empty/emoji/very long. Then 5 of them live (owner-approved).
7. **Triage:** any P0/P1 becomes a hotfix lane before the report. The report goes to the owner in Chinese (REPORT-1018: scorecard, before/after screenshots, residual list, "改了什么 / 怎么证明 / 还剩什么").

---

## Critic review: required changes (RC-1 … RC-40)

Reviewer: critic lens, 10/08. These override conflicting plan text above. Some are history now (for example RC-1 Vercel previews are off; RC-4's disk numbers are from 10-08, the disk is no longer the limit).

#### P0: infrastructure (before any W0 lane starts)
1. **RC-1 Turn Vercel previews off for lane branches.** E1. First W0 commit: `"git":{"deploymentEnabled":{"opus-bay":false,"claude/*":false,"wip/*":false}}` (generator preserves the key, E20; exempt this key from rule 3). Optionally allow a `preview/*` pattern for WEB-ROUTES/WEB-SHELL2 to test redirects on real hosting. Otherwise ~100+ full builds (2,662 HTML + share cards each) queue ahead of production deploys and refill storage.
2. **RC-2 CI triggers + concurrency on both repos** (E2): `on: {push: {branches: [main]}, pull_request: {}}` plus `concurrency: {group: ci-${{ github.ref }}, cancel-in-progress: true}`. Owner: WEB-GUARDS (web), API-ACCOUNT (api). Add workflows to the hot-file table.
3. **RC-3 Delete the merge-queue option** (§4, §6 10/16): impossible on user-owned repos (E3). Plan the serial train for what it is (RC-36).
4. **RC-4 Disk budget** (E4): ≤8 concurrent web worktrees; delete each lane worktree right after merge (rmdir any junction first, never `--force`); preflight `df` ≥8 GB before `npm ci`/build; ask the owner/Opus session before touching the ~100 old `wt/w4-*…w9-*`, `i4-*` worktrees (not ours).
5. **RC-5 Usage-window + resume protocol** (memory: 13 lanes burned a 5-h window in ~3 h): ≤8 concurrent agent lanes; W1's ~20 lanes in 2–3 staggered batches; commit locally every 20–30 min (no WIP pushes); `RESUME.md` per worktree; resumes are new runs from those notes.

#### Architecture
6. **RC-6 Prerender must link route CSS** (E7). WEB-ROUTES extends `modulePreloads()` to emit `<link rel="stylesheet">` for every `css[]` in the visited graph; verify-release asserts it. Until then no lane may move CSS out of the global bundle for a prerendered route (rule 5 / D6 / CSS-PRUNE), or prerendered `<main>` paints unstyled.
7. **RC-7 /en shell gate vs the new header** (E8). "简/繁/EN" labels and cross-locale links in the prerendered header fail `verify-release.mjs:32-33`. Render the language control as `<button>`s (no hrefs), mark the subtree `data-lang-switch` with per-option `lang` attributes, and teach verify-release to skip that subtree. Add WEB-SHELL2 (and HOMEPREP, for ceilings) to the verify-release edit order.
8. **RC-8 OPUS contract additions** (E13, E14): (i) `Home3DTile` and the "按日历看" `<Link to="/calendar">` must be eagerly rendered (a `React.lazy` section renders only its fallback in `renderToStaticMarkup` and in prerender); (ii) desktop 更多▾ content must exist in the DOM when closed; (iii) `simplifySearch` stays synchronous; HOMEPREP adds an async preload with identity fallback; `test:opus` on both.
9. **RC-9 Tailwind re-pointing** (E9, E10). Use channel tokens (`--color-brand-rgb: 9 107 84`) and `rgb(var(--color-brand-rgb) / <alpha-value>)`; add a test that compiles Tailwind and asserts `border-baylink-border/60` etc. still emit. Split WEB-TOKENS: **TOKENS-A** (px→rem, `--reading-scale` pin, root rem, `reading-init.js`, simple mode) with the ≤0.5% pixel-diff gate; **TOKENS-B** (palette re-point) with a reviewed before/after set. The single ≤0.5% gate is unpassable when the page background changes.
10. **RC-10 Codemods merge before lanes branch.** The QUICK codemods (weights, eyebrows, ↗) and the TOKENS-A px→rem touch most CSS/TSX files; "re-run the codemod after rebase" fails because the rebase stops on conflicts first. Ship one pixel-identical CODEMOD PR in W0 (by 10/9 15:00) and branch W1 lanes from it; later codemods run on each lane branch before rebasing.
11. **RC-11 i18n mechanics** (E12): (i) `linkifyPhones` must run on the already-translated string (`translateText(paragraph)` then split), else /en paragraphs fall back to Chinese (the JSX runtime keys whole zh strings); test on `/en/guides/bay-area-chinese-senior-services-referral-guide`. (ii) D17 language memory: redirect in `public/reading-init.js` before paint, not a client replace after paint (zh-Hans flash). (iii) The `?lang=` edge 301 excludes `/opus-bay` and `/play`, keeps `date`, `region`, `from`, `stops`; add those URLs plus `/en/this-week`, `/zh-Hant/this-month`, `/en/n/sf` to `tests/legacy-urls.test.ts` and the post-deploy curl list. (iv) Add an S lane WEB-I18N (zh-Hant term table for the top 50 UI/editorial words, I18N-05; API error codes → 3-locale messages, I18N-07; BayBay en half-width punctuation, I18N-13) or lower 多语言 to 7.5 in §2.
12. **RC-12 Daily rebuild** (E19): prerendered "本周末", `/events` default and ended-event noindex go stale between deploys (rare during R1). Owner creates a Vercel Deploy Hook; a scheduled GitHub Action calls it at 00:10 PT; or render date-dependent blocks client-only with reserved height.
13. **RC-13 vercel.json freshness in CI**: `pretest` regenerates `vercel.json`, so `route-hosting.test.ts` passes on a stale committed file. Add `npm run sync:public-routes && git diff --exit-code vercel.json` (also catches GPT content PRs whose new ids would 404 on direct load).
14. **RC-14 Ratchet baselines are generated files**: `style-ratchet.baseline.json`, English-ratchet count, lazy-CSS allowlist conflict on every rebase. Lanes don't commit them; the captain runs `ratchet:update` in the final regenerate commit; CI fails only when current > committed.
15. **RC-15 Favorites for fresh content**: `/api/planner/favorites/:kind/:id` 404s on ids missing from the API's copied catalog. Web falls back to a local save plus a retry; API-SYNC runs after every content merge, GPT's included.
16. **RC-16 Postcards**: copy the chosen `public/opus-bay/**` postcards into `public/guides/3d/` through the WEB-IMAGES pipeline with provenance records; never write variants into `public/opus-bay/`.
17. **RC-17 Home budget ledger**: zh 214.7/220 KiB, en 357.8/360. Every W1 lane PR prints its zh/en home delta; the captain keeps a ledger and reserves ≥12 KiB zh / 8 KiB en for WEB-HOME; any overrun must lazy-load, respecting RC-8.

#### BayBay on Haiku 5.5
18. **RC-18 Fast-path parameters** (E15–E17): `max_tokens` ≥4,000 (thinking counts; 1,500 → `max_tokens` stop → incomplete → Sonnet retry). Add an eval arm with Haiku-low and `thinking:{type:"disabled"}` (legal on Haiku at low/medium/high, 400 on Sonnet 5.5). Set effort explicitly on every route (Sonnet 5.5 defaults to high). Add a unit test that Anthropic payloads never carry `temperature/top_p/top_k` (400 on Haiku; today only the OpenAI paths set them, `baybayAgent.js:510,536`).
19. **RC-19 Adapter work for caching and system messages** (E15, E18): `system` becomes a blocks array with `cache_control` on frozen block 1; the adapter accepts `role:"system"` items; catch 400 "role 'system' is not supported" and fall back to a user-turn `<system-reminder>`; eval both paths on Haiku.
20. **RC-20 R0SWITCH scope**: keep `baybay_professional` (safetyTopic answers, now model answers after API-BB-GUARD) on Opus or Sonnet-low during R0; the current loop puts the final instruction straight after `tool_result` (H8), which Haiku may treat as injection; land the switch before the 10/9 18:00 five-question smoke (or run a second smoke after it); give the owner a one-env rollback (`BAYBAY_MODEL_AGENT=claude-opus-5-5`) in Chinese.
21. **RC-21 Streaming safety**: no `draft` events for safetyTopic/professional routes or low-evidence routes; gate `draft` on a client capability field (`assistantVersion: 3`) so stale tabs (200-event cap, `baybay-stream.ts:34-36`) never receive it.
22. **RC-22 Cache invalidators**: add a byte-hash test and review rule — no date/time/`now` in system block 1 (day-level date goes in the user turn); tools name-sorted, two prefixes only (site/member); effort and thinking fixed per route; zh/en system variants accepted as separate prefixes; changing `ANTHROPIC_BAYBAY_EFFORT` is a documented cache reset. Scope "cache_read > 0" to second calls of agent runs. At R1 traffic the 5-minute TTL makes fast-path reads rare, which is fine at Haiku prices.
23. **RC-23 Eval logistics**: say which key/workspace pays which line (eval $44 fits the $60 cap only if CNT drafting's $25 is elsewhere); harness 429/529 backoff and concurrency 2 (a new workspace may sit on a low rate tier). Fallback if the eval key is missing at 10/9 09:00: no model switch for R0; the owner sets `ANTHROPIC_BAYBAY_EFFORT=low`.

#### Gaps
24. **RC-24 Unowned surfaces**: T16 `/recommend` (one of the 20 SYS templates) → 301 to `/events` now in WEB-ROUTES (owner OK) or migrate it; auth/reset/report/blocked/share dialogs and the QuickExplore overlay → WEB-SHELL2; `/me/bookings` and `features/bookings/*` → WEB-ACCOUNT; SSR share pages `api/{post,outing,user-card}-page.ts` and `server/public-share-page.ts` → WEB-SHARE-SEO; legal-page English (27 missing strings, frontend.md §1.6) → WEB-SECONDARY-B content, not layout only.
25. **RC-25 States**: every template lane's acceptance includes zero-result, API-down, loading (fixed-height skeleton) and offline states, using the WEB-UI primitives. The §5.3 resilience sweep checks each.
26. **RC-26 Large text and simple mode on W2/W3 templates**: numeric READ probe at 特大 and in simple mode in every template lane's acceptance; extend the px→rem codemod to TSX arbitrary values (`text-[13px]` → `text-[0.8125rem]`) and inline `fontSize` styles. CSS alone leaves 155 small `text-[7–11px]` classes unscaled.
27. **RC-27 Re-audit lenses**: add I18N, SEC (re-check SEC-01..16), 3D-INT and FUNC-LINK lenses. In 1007 these 18% of the weight were "估计".
28. **RC-28 Content supply and Chinese relevance**: GPT by 10/16: every region ≥5 sourced events for weekends 10/24–11/14 (about 45 more) and ≥3 Chinese-language/community events per weekend. Add to §6 with an owner check; the re-audit counts both.
29. **RC-29 Lints vs GPT**: CNT lints error only for overlay-covered ids; new ids warn; `event-facts.ts` derives a fallback `shortTitle`; GPT is told about the new fields.

#### Unrealistic claims
30. **RC-30 Score and timeline honesty**: realistic ≈7.5–7.8 (§2). Run the full cold re-audit on W0–W2 at **10/17 PM**, make 10/18 a fix day with W3 as optional, and add an explicit hotfix window (10/19–10/21, hotfixes only) before the "≥8" message. The owner gave no date, only "≥8 then I'll look".
31. **RC-31 Agree the 图文结合 metric now** (E11): TypeCover root carries `data-cover="type"`; the probe reports `realPhotoArea` and `coverArea` separately; targets coverArea ≥0.45 phone (home and events) and realPhotoArea ≥0.15; the VISUAL lens judges TypeCover as the 1007 §5.3 A2 template. Without this the plan fails its own gate (88% TypeCover, content.md §0.1). **UI9-IMAGES (2026-10-21):** `[data-cover=type]` must be 0 on every page; `data-cover="lqip"` marks the empty frame only.
32. **RC-32 Real-image decision on 10/9, not 10/14**: ask the owner one question: may BAYLINK show an organiser's own event image (og:image of the official event page) next to coverage of that same event, with credit, link and a takedown contact? If yes, API-FRESH-TRIAGE candidates become per-item owner-approved download lists by 10/13, giving ≥30 event-specific covers for 10/17–11/1. If no, state that 图文结合 lands near 7.
33. **RC-33 `/events` landing performance is required, not stretch**: build a slim generated events index (pattern `generate-home-catalog.ts`); `/events` must not import `data/guides` or full `local-discoveries`; ceiling ≤400 KB gz JS and LCP ≤3.5 s on the cold profile. Today `/this-week` ships 1,023 KB with LCP 7.28 s (quality.md §1).
34. **RC-34 BayBay quality measured on unseen questions**: the re-audit BBLIVE lens writes ≥20 new questions; re-date the golds of the 30 (Fleet Week, Santana Row, "这周末"). Add ≥6 multi-turn follow-ups (carry `candidateIds` in signed state; the fast path keeps 2 turns ≤300 chars) and ≥6 thin-evidence items with mustNotInclude for invented names or prices. Reuse a sample of the 77 existing casebook items (`audit-api/scripts/baybay-*-cases*.json`).
35. **RC-35 G8 timing**: changed-only prompts are 14% weekend, 13% events, 20% offers (content.md §2.3). WEB-FRESH alone cannot reach ≤10%. Scope the W0 acceptance to the weekend 63 after GPT clears the 24 flagged items; site-wide ≤10% is accepted after API-FRESH-TRIAGE. Triage stops at `ANTHROPIC_USE_UNTIL` (10/30) unless G18 is resolved; say so in the 10/23 decision.

#### Sequencing
36. **RC-36 Throughput**: ~33 web PRs in 6 merge days at 45–60 min each, serial, with zero failures; W2+W3 = 17 PRs between 10/15 and 10/18 12:00. (i) Verify production every 3 merges, not each one; (ii) optionally run W2 through an integration branch (`claude/w2-int`, one main PR per 3–4 lanes); (iii) move WEB-CSS-PRUNE after 11/15, or limit it to provably dead rules with no import moves (RC-6); (iv) a W3 lane not green by 10/17 18:00 waits and is reported as a known gap.
37. **RC-37 Hot-file table additions**: `.github/workflows/*.yml`; the `vercel.json` `git` key (W0 first commit); `scripts/verify-release.mjs` order gains HOMEPREP and SHELL2; `src/i18n/en.json` (5,278 lines; UI lanes use `t()` only); ratchet baselines (RC-14); `src/lib/monthly.ts` (ELDERS → EVENTS).
38. **RC-38 State drift**: start W0-MERGE from `git ls-remote` heads (E6), not plan §0.1. a2 is already pushed.
39. **RC-39 Owner card**: nine owner items are due 10/8 18:00. Collapse them into one Chinese card (≤10 lines, each with its default if there's no answer) and state the fallbacks: no eval key → no R0 switch; no A1 → R0 runs on shared keys; no picks approval → a3 picks as drafted. Add: Deploy Hook (RC-12), real-image question (RC-32), `/recommend` 301 (RC-24), deleting old worktrees (RC-4).
40. **RC-40 Freeze exemptions**: the R1 freeze explicitly allows the Thursday picks PR (a3 needs a code merge and deploy each week), API-SYNC and GPT content-data PRs.
