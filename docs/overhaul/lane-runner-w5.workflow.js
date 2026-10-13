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
