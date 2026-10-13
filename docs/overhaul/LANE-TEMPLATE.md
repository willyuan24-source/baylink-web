# Lane template and lane runner

> 怎么写一条 lane、怎么一次跑一批。中文摘要在前，细节用英文。
> 本文件会放进公开仓库。下面嵌入的批处理脚本（和同目录的 `lane-runner-w5.workflow.js` 一字不差）已检查过：没有密钥、token、邮箱、账号 ID，也没有 key 文件的路径或文件名。店主本机的私有副本（`C:/Users/willy/opus-qa/overhaul/lane-runner-w5.private.workflow.js`）只多一处：它在"不许读"规则里写了评测 key 文件的位置。这个私有副本不进仓库。
> 脚本里的路径默认是店主的 Windows 电脑；换到 Mac 或别的电脑时，用 `args.paths` 传新路径（第 3 节）。

## 中文摘要

- **一条 lane = 一个 worktree + 一个分支 + 一份 brief + 一个 lane 目录。** brief 写清楚：关哪些缺口（H 编号）、证据在哪、改哪些文件、不许碰哪些文件、怎么验收、跑什么门禁、花多少钱。
- **验收要能量**：写数字和测法，例如"320 宽特大加简洁，13 篇指南 0 处截字（探针 JSON）"，不要写"看起来更好"。
- **一批 lane 用同一个 workflow 脚本跑**：实现 → 独立复核 → 修复。子 agent 只在本地提交，推送、开 PR、合并由主会话（队长）做。
- **Wave 5 直接用 `lane-runner-w5.workflow.js`**（第 4 节是它的原文，第 5 节是它和 Wave 3 旧脚本的区别）。没有 Workflow 工具时，按第 3 节最后一条，用三个依次进行的会话代替。
- **在 Mac 上**：启动时多传一个 `paths`（例子见第 3 节）。没有 `opus-qa` 笔记时，脚本让 lane 改读 `docs/overhaul/reference/`，并自己重新测量缺口。

---

## 1. Brief fields (engineer)

Write each lane as one `## <KEY> (<size>, <repo>, slug <slug>, base <base>, ports <vite>/<cdp>)` section in a brief file (`w1-lanes.md` for waves 0–5-pre, `kit/NEXT-LANES.md` from Wave 5). A batch section starts with a shared header; each lane then has one dense paragraph or a short list. Fields:

| Field | What to write | Example |
|---|---|---|
| **KEY / slug** | UPPER-KEBAB key for the lane dir; lower-kebab slug for worktree `wt/claude-<slug>` and branch `claude/<slug>`. The slug must not exist yet as a local or remote branch (`git branch --list 'claude/<slug>'`, `git ls-remote origin 'refs/heads/claude/<slug>'`); `worktree add -b` fails on an existing branch | `WEB-SEO-3` / `web-seo-3` |
| **Size** | S <½ agent-day, M ½–2, L >2 | M |
| **Repo** | `web` or `api` | web |
| **Base** | Usually `origin/main`. For a lane stacked on an unmerged lane, that lane's tip SHA. For a resume: `worktree exists — RESUME from lanes/<KEY>/RESUME.md; do NOT rebase` | `origin/main (c8debf48 or later)` |
| **Ports** | Unique vite preview port / Chrome CDP port per lane | `5853/9453` |
| **Evidence** | Gap ids (H..) and the lens finding ids behind them, with paths. The agent reads them first and **re-measures on its base**, since some may already be fixed | `audit-1013/gaps.json H41; audit-1013/I18N-SEO-ENG-SEC/findings.json I13-04` |
| **Scope (close list)** | One bullet per gap: the behaviour after the fix, the file(s) and line hints from the audit, the edge cases. Say what NOT to do when there is a tempting wrong fix | "英文页时间 am/pm … in `scripts/generate-english-scopes.ts`; do not touch zh strings" |
| **File ownership** | Files this lane may edit; files owned by other lanes in the same batch (mount or leave a follow-up instead); hot files (MASTER-PLAN §3.0 table) with "minimal, localized edits only" | "SEO-3 owns `src/lib/seo.ts`, `scripts/generate-share-cards.ts` …; VISUAL-2 owns `src/components/ui/*`" |
| **Contracts** | OPUS contract when relevant (`test:opus`; exact list in `HANDOFF.md` §3.8); web↔api contract changes (additive; who deploys first) | "API returns `quota` additively; web reads `baybay ?? top level`" |
| **Acceptance** | Measurable checks with the tool that measures them and where the evidence lands (`lanes/<KEY>/…json`) | "`i18n-html-check` fails on 24 h times in /en; 0 on 33 sampled details (probe-en-time.json)" |
| **Gate** | web: regenerate last (`npm run pretest && npm run build && npm run ratchet:update`, never `--allow-increase`), commit "Regenerate generated files", then **one** `npm run check` on that tip (+ `npm run test:opus` if OPUS-contract files changed). Same order as `HANDOFF.md` §4. api: `npm test` + `npm audit --audit-level=high` | |
| **Screenshots** | UI lanes: before (base built locally) / after, phone 390 + desktop 1440, zh-Hans + en (+ zh-Hant phone), phone 特大 + 简洁显示 for templates touched, under `shots/<KEY>/{before,after}/…` | |
| **Data honesty** (content lanes) | Official URL read today + quote + date in `docs/source-reads-2026-10.md`; never change `verifiedAt` on existing items; no invented facts; no image downloads without an approved list; an agent read is never worded as 人工核对 on the page | |
| **Spend** | `$0` by default. A paid BayBay eval needs an owner-approved cap ("≤$3, engine set + block K") and runs only via the owner's eval-key env file; if refused, write the commands into PR.md (the captain replaces the file path with a placeholder in the public PR body) | |
| **Deliverables** | Local commits only (code commits, then one final "Regenerate generated files"); `lanes/<KEY>/PR.md` (title line, English body, Chinese 改了什么 / 怎么证明 / 还剩什么); `lanes/<KEY>/RESUME.md` kept current | |
| **Depends / merge order** | What must merge first; what this blocks; deploy order | "after API-NOTIFY-2 is live" |

**Acceptance style.** Prefer numbers with a named probe over adjectives. Good: "facts card clear of the action bar on ≥18/22 phone details (probe-facts-after.json)". Bad: "facts card looks fine". When a target cannot be met, the lane says so in "还剩什么" with the measured number and the options. Not meeting a target is fine; hiding it is not.

**File ownership rules.** Two lanes in one batch never edit the same file. If a fix needs another lane's file, write the exact follow-up (file, line, change) into PR.md. Hot files: the MASTER-PLAN §3.0 table, plus `scripts/verify-release.mjs`, `scripts/prerender.tsx`, `scripts/english-sources.json` and `docs/source-reads-2026-10.md` (append-only), which take minimal, localized edits only.

**Evidence links.** Point to the H id **and** the lens finding (the H text is a summary; the lens `findings.json` has the URL, file:line and measurement; `verify/` has the verifier's verdict). For older ids: `audit-1011/gaps.json` (G..), `site-audit-1007/work/<LENS>/findings.json`. On a machine without `opus-qa`, the short H titles are in the `ROADMAP-8-9.md` appendix and the gap must be re-measured.

---

## 2. Filled example (long form)

```
## WEB-SEO-3 (S–M, web, slug web-seo-3, base origin/main c8debf48 or later, ports 5853/9453)

Evidence: audit-1013/gaps.json H41, H45, H46, H47, H48, H50; lens audit-1013/I18N-SEO-ENG-SEC/findings.json
(I13-04, I13-08, I13-09, I13-10, I13-11, I13-13) and EVT-DETAIL/findings.json EVT13-11; verifier notes in verify/.
Re-measure each on your base first (FIX5 changed /events titles).

Close:
- H41 /en editorial text uses 12-hour times and "Oct 13, 2026" / "Sep 25–Oct 31" dates. Convert in
  scripts/generate-english-scopes.ts when the English scopes are generated (not at runtime), and make the
  /en html check fail on 24-hour times (\b([01]?\d|2[0-3]):[0-5]\d\b without am/pm) and ISO dates in visible text.
- H46 English <title> = shortTitle + " | BAYLINK", ≤60 characters; the long form stays in og:title and the H1.
- H47 Event JSON-LD: free events get offers {price:0, priceCurrency:"USD"}; organizer from the source domain
  (registry name); inLanguage per locale; startDate with offset where a time exists; location.address street
  when the record has one. Validate 30 sampled events with the schema-check script.
- H48 the 6 new API error codes get English in src/i18n/api-errors-en.ts (list them from audit I13-11).
- H50 src/features/ads/OfficialAds.tsx: Chinese ads on /en carry lang="zh-Hans" translate="no".
- H45 share cards: when an item has a cover with rights.promoAllowed, place it in the top 55% of the
  1200×630 card; zh cards use the Chinese tagline.

Owns: src/lib/seo.ts, src/lib/discovery-metadata.ts (if present), scripts/generate-english-scopes.ts,
scripts/generate-share-cards.ts, scripts/share-card-*.{ts,mjs}, scripts/verify-share-cards.ts,
src/i18n/api-errors-en.ts, src/features/ads/OfficialAds.tsx, JSON-LD builders.
Hot (minimal edits): scripts/prerender.tsx (metadata only), scripts/verify-release.mjs (checks only).
Not yours this wave: src/components/ui/* (VISUAL-2), guide components (GUIDES-READ) and the /guides title
strings (GUIDES-READ), /events views (LINK-2).

Acceptance:
- 0 24-hour times / ISO dates in visible text on 33 sampled /en details + 25 hubs (probe JSON in lane dir);
  the html check fails on a planted "18:30" (test).
- English titles ≤60 chars on all built /en pages (verify script count = 0 over).
- JSON-LD: 30/30 sampled events have offers, startDate, location.address (when known), organizer, inLanguage.
- api-errors-en covers every code the API can return (test enumerates the API's code list snapshot).
- Share cards: verify:share-cards green; ≥10 cards with a licensed photo; zh tagline on zh cards.
Gate: regenerate, commit, then npm run check once on that tip; test:opus only if prerender.tsx changed beyond metadata.
Screenshots: 6 share cards before/after; /en detail and hub at phone 390 + desktop 1440.
Spend: $0. Deliverables: PR.md (Chinese 改了什么/怎么证明/还剩什么), RESUME.md.
Depends: none. Merge order: after WEB-GUIDES-READ (it changes the /guides title; SEO-3 owns English title length).
```

The compact form of the same lane (one paragraph, as in `w1-lanes.md`) is in `NEXT-LANES.md`. Either form works: the runner passes the brief text or a pointer to the section.

---

## 3. Running a batch

1. **Write the briefs** (a batch header + one section per lane). Include slugs, ports and bases.
2. **Check usage** (`get_usage`, or `/usage` outside the desktop app). Launch only what fits the weekly cap. ≤7 lanes at once.
3. **Launch** with the Workflow tool: `scriptPath` = `C:/Users/willy/opus-qa/overhaul/lane-runner-w5.private.workflow.js` on the owner's Windows PC (it names the eval-key file in its "never read" rule), or the kit's `lane-runner-w5.workflow.js` anywhere else (on a new machine: `docs/overhaul/lane-runner-w5.workflow.js` in the web clone). `args`:

```json
{ "lanes": [
  { "key": "WEB-SEO-3", "slug": "web-seo-3", "repo": "web", "base": "origin/main", "ports": "5853/9453",
    "brief": "C:/Users/willy/opus-qa/overhaul/kit/NEXT-LANES.md — read the 'Wave 5' header, then section ## WEB-SEO-3" },
  { "key": "API-BB-4A", "slug": "api-bb-4a", "repo": "api", "base": "origin/main",
    "brief": "C:/Users/willy/opus-qa/overhaul/kit/NEXT-LANES.md — 'Wave 5' header + ## API-BB-4A. api gate: npm test + npm audit --audit-level=high" }
] }
```

   On a Mac or any machine with other paths, add `paths` (every key optional; defaults are the Windows paths):

```json
{ "paths": { "qa": "/Users/<you>/baylink/opus-qa", "web": "/Users/<you>/baylink/baylink-web",
             "api": "/Users/<you>/baylink/baylink-api", "wt": "/Users/<you>/baylink/wt",
             "kit": "/Users/<you>/baylink/baylink-web/docs/overhaul" },
  "lanes": [ { "key": "WEB-SEO-3", "slug": "web-seo-3", "repo": "web", "base": "origin/main", "ports": "5853/9453" } ] }
```

   Without `brief`, a lane reads `<kit>/NEXT-LANES.md` section `## <KEY>`. When `<qa>/overhaul/MASTER-PLAN.md` or `<qa>/audit-1013` is missing, the agents use `<kit>/reference/` and re-measure.

4. **Resume after a stop**: relaunch only the unfinished lanes with `base: "worktree exists — RESUME from lanes/<KEY>/RESUME.md; do NOT rebase"` and a brief line saying which stage (implement / review / fix) was cut off. Never use `resumeFromRunId` (it re-runs finished lanes).
5. **Results**: each lane returns `{report, verify, fix?}`. Read `verify.findings`; the fix stage already handled blocking/should_fix items. Then integrate and merge (`HANDOFF.md` §3–4).
6. **Without the Workflow tool** (CLI, another account, a cloud session): run the same three stages as three sequential sessions or sub-agents per lane, each given the text of `COMMON` + the lane header from the script. Session 1 "Do the lane now and return the report" (write the report into `lanes/<KEY>/report.json`). Session 2 is a fresh reviewer with the reviewer prompt and that report; it writes `lanes/<KEY>/verify.json` and does not commit. Session 3 runs only if `verify.json` has blocking/should_fix findings or `acceptance_met` is false, with the fix prompt. Same rules: local commits only; the captain pushes.

---

## 4. The lane runner script (`lane-runner-w5.workflow.js`, verbatim)

Built on 2026-10-13 from the Wave 3 batch A runner (on the owner's PC: `C:/Users/willy/.claude/projects/C--Users-willy-baylink-opus/b22477a8-aba6-4f04-b881-741d10ae82b8/workflows/scripts/baylink-wave3a-wf_53794899-ac0.js`) (last used for Wave 3 and Batch 5) with the edits in §5. Older generic version: `C:/Users/willy/opus-qa/overhaul/batch-runner.workflow.js` (it has a `readOnly` lane option that this one dropped).

```js
// BAYLINK lane runner for Wave 5 (Workflow tool script). Built 2026-10-13 from the Wave 3 batch A runner
// with the edits listed in kit/LANE-TEMPLATE.md §5. PUBLIC copy: the eval-key file path is a placeholder; the private copy is C:/Users/willy/opus-qa/overhaul/lane-runner-w5.private.workflow.js.
// Launch: Workflow tool, scriptPath = this file, args = { lanes: [{ key, slug, repo: 'web'|'api', base, ports, brief }], paths?: { qa, web, api, wt, kit } }.
// Paths default to the owner's Windows PC. On another machine (for example a Mac) pass args.paths, e.g.
// { qa: '/Users/<you>/baylink/opus-qa', web: '/Users/<you>/baylink/baylink-web', api: '/Users/<you>/baylink/baylink-api',
//   wt: '/Users/<you>/baylink/wt', kit: '/Users/<you>/baylink/baylink-web/docs/overhaul' }. Missing opus-qa files fall back to kit/reference/.
export const meta = {
  name: 'baylink-wave5',
  description: 'BAYLINK Wave 5 lanes: implement, independent review, fix (local commits only)',
  phases: [{ title: 'Implement' }, { title: 'Verify' }, { title: 'Fix' }],
}
const A = (typeof args === 'object' && args) || {}
const P = Object.assign({
  qa: 'C:/Users/willy/opus-qa',
  web: 'C:/Users/willy/OneDrive/Desktop/baylink-web',
  api: 'C:/Users/willy/OneDrive/Desktop/baylink-backend',
  wt: 'C:/Users/willy/wt',
}, A.paths || {})
const SP = P.qa
const OUT = P.qa + '/overhaul'
const KIT = P.kit || OUT + '/kit'
const REPO = { web: P.web, api: P.api }

const COMMON = `
You are a senior engineer on BAYLINK (https://www.baylink.us; zh-Hans/zh-Hant/en site for Chinese families in the SF Bay Area: "湾区去哪、怎么办 · 有来源的中文答案"). The owner wants every rubric dimension at 8–9/10 (2026-10-07 audit rubric; latest re-audit 10-13 in ${SP}/audit-1013, weighted 7.0; plan ${KIT}/ROADMAP-8-9.md). Read: ${OUT}/MASTER-PLAN.md (§0.2 decisions, §3.0 rules + OPUS contract + hot-file table, your lane's section if it has one, and the Critic review RCs — RCs override plan text) and ${OUT}/w1-lanes.md (history of lane briefs and owner decisions) and ${KIT}/NEXT-LANES.md — the "Wave 5" header (context, shared rules, file ownership) and your lane's section. Lens evidence from planning: ${SP}/overhaul/understand/*.md. Re-audit evidence: ${SP}/audit-1013/gaps.json (H01–H79) and ${SP}/audit-1013/<LENS>/findings.json + verify/ (ids in your brief). MISSING FILES (another machine): if ${OUT}/MASTER-PLAN.md, ${OUT}/w1-lanes.md or ${SP}/audit-1013 do not exist, use ${KIT}/reference/PLAN-CORE.md (plan core + RCs), ${KIT}/reference/REPORT-1013.md and ${KIT}/reference/gaps-1013.json, and re-measure every gap yourself (lens findings are not available); create ${OUT}/lanes and ${OUT}/shots if missing.

SETUP: if your worktree does not exist, create it: git -C <repo> fetch origin && git -C <repo> worktree add <worktree> -b <branch> <base>, then npm ci inside it (real node_modules, no junctions). The owner's checkout (<repo>) is only used for fetch + worktree add — never touch its working tree. If the worktree exists, resume: inspect git log/status and <lane dir>/RESUME.md, never redo finished work.
HARD RULES: work only in your worktree; commit locally only (never push, merge, rebase, open PRs, stash, or remove worktrees); never edit .github/workflows, src/opus-bay/**, tests/opus-bay-*, vite.opus.config.ts, vite.config.ts manualChunks; never read/print .env files or the owner's eval-key env file (its path is in the owner's private notes; for a paid eval write the exact command into PR.md for the owner); no production writes or logins (GET reads fine; block /api/product-events and /api/client-errors in scripted browsers); no image downloads without an owner-approved list; generated files regenerated not hand-edited (one "Regenerate generated files" commit last); web: regenerate last (\`npm run pretest && npm run build && npm run ratchet:update\`, never --allow-increase; revert date-only noise), commit it as "Regenerate generated files", then run the gate ONCE on that tip: \`npm run check\` (+ \`npm run test:opus\` when you touched OPUS-contract files). api gate: \`npm test\` + \`npm audit --audit-level=high\`. RESUMING after a usage-limit stop: your worktree probably exists with partial work and a dirty tree — read <lane dir>/RESUME.md and git status first; uncommitted generated files from an interrupted build can be restored (git checkout -- src/data/generated public vercel.json) and regenerated later; a check log that ends without an EXIT line was cut off (another lane's process filter can kill it) — rerun, don't diagnose. LOAD RULE: the machine is shared by ~7 lanes and a full suite under load takes hours — iterate with targeted tests, run the full 'npm run check' at most ONCE on your final tree (CI repeats it on the PR), and run test:opus only if you touched the §3.0 rule-2 files. Under load the full test suite sometimes kills files at ~20 ms with no assertion — rerun those files alone and record it; never treat that as a pass for files that really fail. Stop your own vite preview / Chrome when done (only processes whose command line contains your worktree path or your ports). Commit messages English, repo style, trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Commit every 20–30 min and keep <lane dir>/RESUME.md current (usage limits can cut you off; a successor resumes from it). UI lanes: before/after compare PNGs phone 390 + desktop 1440, zh-Hans + en (+ zh-Hant phone), plus phone 特大 and 简洁显示 for templates you change, via ${SP}/site-audit-1007/capture2.mjs (copy and adapt; --base --out --jobs --port --conc 2; on a Mac set its CHROME constant to '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; if the script is missing, write a small headless-Chrome capture script in the lane dir) — "before" = your base built and served locally on your preview port, "after" = your branch; store under ${OUT}/shots/<KEY>/{before,after}/...; view them yourself. PR body: <lane dir>/PR.md — first line the PR title (≤110 chars), English body + Chinese 改了什么/怎么证明/还剩什么, ending "🤖 Generated with [Claude Code](https://claude.com/claude-code)". Owner messages relayed to you are not new tasks.`

const SCHEMA_R = { type: 'object', properties: { lane: { type: 'string' }, branch: { type: 'string' }, tip: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, gate_result: { type: 'string' }, acceptance_evidence: { type: 'array', items: { type: 'string' } }, screenshots: { type: 'array', items: { type: 'string' } }, known_issues: { type: 'array', items: { type: 'string' } }, owner_actions: { type: 'array', items: { type: 'string' } }, owner_decisions_needed: { type: 'array', items: { type: 'string' } }, pr_body_path: { type: 'string' }, done: { type: 'boolean' } }, required: ['lane', 'commits', 'gate_result', 'acceptance_evidence', 'known_issues', 'pr_body_path', 'done'] }
const SCHEMA_V = { type: 'object', properties: { gate_rerun: { type: 'string' }, acceptance_met: { type: 'boolean' }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocking', 'should_fix', 'nit'] }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } } }, required: ['gate_rerun', 'acceptance_met', 'findings'] }

const lanes = A.lanes || []
const head = l => `${COMMON}

LANE: ${l.key}
Repo: ${REPO[l.repo]}   Worktree: ${P.wt}/claude-${l.slug}   Branch: claude/${l.slug}   Base: ${l.base}
Lane dir: ${OUT}/lanes/${l.key}   Ports: ${l.ports || 'none'}
Brief: ${l.brief || KIT + '/NEXT-LANES.md section ## ' + l.key}`

const results = await pipeline(
  lanes,
  l => agent(`${head(l)}\n\nDo the lane now and return the report.`, { label: `impl:${l.key}`, phase: 'Implement', schema: SCHEMA_R }),
  (rep, l) => !rep ? null : agent(`${head(l)}\n\nROLE: independent skeptical reviewer (not the implementer). Do not commit. Review git diff ${l.base}...HEAD for correctness, regressions, OPUS-contract/hot-file/ownership violations, missing tests, i18n (3 locales), RC-25 states, READ at 特大/简洁显示, budgets/ratchets, generated churn, data honesty (sources, verifiedAt rule, no invented facts); re-run only the decisive parts of the gate (targeted tests for the changed areas, lint, tsc -b, build + verify-release) unless the implementer has no full-gate log on this exact tip — say which; open the compare PNGs; check the audit findings named in the brief are really closed. 'blocking' only for real defects or unmet acceptance.\n\nIMPLEMENTER REPORT:\n${JSON.stringify(rep, null, 2)}`, { label: `verify:${l.key}`, phase: 'Verify', schema: SCHEMA_V }).then(v => ({ key: l.key, report: rep, verify: v })),
  (rv, l) => {
    if (!rv || !rv.verify) return rv
    const todo = (rv.verify.findings || []).filter(f => f.severity !== 'nit')
    if (!todo.length && rv.verify.acceptance_met) return rv
    return agent(`${head(l)}\n\nYou are the implementer. Fix every blocking/should_fix finding below (or explain precisely why it is wrong), and cheap nits; commit (code commits BEFORE the final "Regenerate generated files" commit — rebuild the tail with cherry-picks if needed, never rebase onto main), re-run the gate, refresh screenshots/PR.md, return the report.\n\nREVIEW:\n${JSON.stringify(rv.verify, null, 2)}`, { label: `fix:${l.key}`, phase: 'Fix', schema: SCHEMA_R }).then(fix => ({ ...rv, fix }))
  },
)
return results.filter(Boolean)
```

How it works:
- `pipeline(lanes, implement, verify, fix)` runs each lane through three agents. Lanes run in parallel; each stage starts as soon as that lane's previous stage returns.
- **Implement** returns `SCHEMA_R` (commits, gate result, acceptance evidence, known issues, owner actions, owner decisions needed, PR.md path).
- **Verify** is a separate skeptical reviewer (no commits) that returns `SCHEMA_V` findings: blocking / should_fix / nit.
- **Fix** runs only when there are non-nit findings or acceptance is not met. It keeps code commits before the final regenerate commit (rebuilding the tail with cherry-picks, never rebasing onto main).
- `COMMON` carries every hard rule. Put lane-specific rules in the brief, not in `COMMON`.

---

## 5. What changed from the Wave 3 runner

Already applied in `lane-runner-w5.workflow.js` (public) and `C:/Users/willy/opus-qa/overhaul/lane-runner-w5.private.workflow.js` (private; identical except its header comment and the eval-key file location in the "never read" rule). Kept here so a later wave can redo the same edits on a newer script.

| # | Was (Wave 3 batch A) | Now (Wave 5) |
|---|---|---|
| 1 | `name: 'baylink-wave3a'` and its description | `name: 'baylink-wave5'`, `description: 'BAYLINK Wave 5 lanes: implement, independent review, fix (local commits only)'` |
| 2 | `(2026-10-07 audit rubric; 10-11 re-audit in ${SP}/audit-1011)` | `(2026-10-07 audit rubric; latest re-audit 10-13 in ${SP}/audit-1013, weighted 7.0; plan ${OUT}/kit/ROADMAP-8-9.md)` |
| 3 | `${OUT}/w1-lanes.md — especially the newest section "Wave 3 batch A" …` | `${OUT}/w1-lanes.md (history …) and ${OUT}/kit/NEXT-LANES.md — the "Wave 5" header … and your lane's section` |
| 4 | `Re-audit evidence: ${SP}/audit-1011/<LENS>/…` | `Re-audit evidence: ${SP}/audit-1013/gaps.json (H01–H79) and ${SP}/audit-1013/<LENS>/findings.json + verify/` |
| 5 | web gate `npm run check` + `npm run test:opus` (always), then `npm run ratchet:update` | regenerate (pretest, build, ratchet:update) → commit "Regenerate generated files" → one `npm run check` on that tip (+ `test:opus` when OPUS-contract files changed); api gate `npm test` + `npm audit --audit-level=high` |
| 6 | `RESUMING after a usage-limit stop (10-12 03:50–07:56):` | `RESUMING after a usage-limit stop:` |
| 7 | `(some were killed by another lane at 03:46)` | `(another lane's process filter can kill it)` |
| 8 | `head`: `'w1-lanes.md "Wave 3 batch A" section ## ' + l.key` | `'C:/Users/willy/opus-qa/overhaul/kit/NEXT-LANES.md section ## ' + l.key` |
| 9 | block `/api/product-events` in scripted browsers | block `/api/product-events` and `/api/client-errors` |
| 10 | "never read/print .env or <the eval-key file path>" | public: "…the owner's eval-key env file (its path is in the owner's private notes; for a paid eval write the exact command into PR.md for the owner)"; private copy keeps the path |
| 11 | `SCHEMA_R` without owner decisions | adds `owner_decisions_needed` (array of strings), for choices such as H58 |
| 12 | Hard-coded Windows paths (`SP`, `OUT`, `REPO`, worktree root) | `args.paths` (`qa`, `web`, `api`, `wt`, `kit`) with the Windows paths as defaults; `KIT` for the kit files; a MISSING FILES rule pointing to `kit/reference/`; a Mac Chrome path note for capture2 |

---

## 6. Captain checklist per batch

1. Briefs written; slugs new; ports unique; bases correct; the usage check done.
2. Launch; note the run id in the private notes (`opus-qa/overhaul/`), not in the kit.
3. While lanes run: prepare the integration plan (merge order, expected conflicts, hot files).
4. When a lane returns: read its `verify` findings and PR.md "还剩什么"; check `git status` is clean and the last commit is "Regenerate generated files".
5. Integrate UI lanes on `claude/w<N>-int` (one gate) or merge single lanes (`HANDOFF.md` §4). Sanitize each PR body first (`HANDOFF.md` §3.13).
6. After each content merge: the next API-SYNC-3 run.
7. After the batch is live: lean re-audit or a targeted live check; update `ROADMAP-8-9.md` scores and `HANDOFF.md`; publish the kit (`HANDOFF.md` §1, one docs-only PR per wave).
