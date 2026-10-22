# BAYLINK 全站优化 · 交接（给任何一个新的 Claude 账号）

> 写于 2026-10-13，16:30 更新（湾区时间）。读完这一份就能接着做，不需要以前的聊天记录，也不需要原来那台电脑（见"在新电脑 / 新 Mac 上继续"）。
> **本文件取代之前所有的交接文件**：`opus-qa/overhaul/HANDOFF-*.md`、`HANDOFF-LATEST.md`、`opus-qa/HANDOFF-新Claude-BAYLINK优化.md`，以及项目记忆里"先读 HANDOFF-2026-10-12-AM"的说法。有冲突时以本文件为准。但线上实时状态（第 9 节第 1 步查到的）又比本文件准。
> 配套文件（同一目录）：`README.md`（索引）、`ROADMAP-8-9.md`（路线图、分数、店主日程）、`NEXT-LANES.md`（马上能开的 lane）、`LANE-TEMPLATE.md`（怎么写 lane）、`lane-runner-w5.workflow.js`（批处理脚本）、`reference/`（脱敏的审计报告、缺口表和计划核心，给没有原电脑的人用）。
> **公开副本**放在 baylink-web 仓库的 `docs/overhaul/`。第一次发布合并以后，以仓库 main 上那一份为准；店主电脑上的 `C:/Users/willy/opus-qa/overhaul/kit/` 是工作副本。怎么同步见第 1 节。
> 本文件会放进公开仓库：不写密钥、key 文件的路径和内容、账号邮箱、私人电话，也不写未修的安全细节。安全事项一律写"店主安全事项（见私有笔记）"。私有笔记在店主电脑的 `C:/Users/willy/opus-qa/overhaul/`，不进仓库。

---

## 换账号怎么接（店主先看这一段）

- **还是这台电脑**：git、gh 登录和 `C:/Users/willy/opus-qa` 里的笔记都跟着电脑走，照常能用。Claude in Chrome 可能要重新配对一次。
- **桌面版才有的工具**：Workflow（批量跑 lane）、PR 工具（自动合并、CI 监控）和用量工具 `get_usage`，只有 Claude 桌面版有。命令行版用 `/usage` 看用量；自动合并用 `gh pr merge --auto --squash`，如果被拒，就请店主在 GitHub 上点合并。
- **从哪个文件夹开新会话**：选一个中性文件夹，例如 `C:/Users/willy/opus-qa`。不要选 `C:/Users/willy/baylink-opus`（那是 3D 世界的会话），也不要选店主自己的 checkout。第一句话发：**"读 C:/Users/willy/opus-qa/overhaul/kit/HANDOFF.md 然后继续"**。
- **用量上限**：≤55% 是店主现在这个账号本周的规则。新账号有自己的周额度，先问店主用哪个上限。没有新说法时，10/19 重置以后仍按 ≤55%。
- **换了电脑（例如新 Mac），或者用云端会话**：照下一节做。`opus-qa` 里的笔记、审计证据、lane 目录、worktree 和评测 key 文件都不在，只有两个仓库和仓库里的这套 kit（含 `reference/` 里脱敏的审计和计划）。缺口要在新电脑上重新测量（`ROADMAP-8-9.md` 第 5.1 节的精简复审）。可选（要店主同意）：开一个**私有**仓库，或打包拷走，保存笔记和审计。

---

## 在新电脑 / 新 Mac 上继续

**结论：不需要把整台电脑的文件拷过去。** 代码都在 GitHub；这套交接文件合并后就在 baylink-web 仓库的 `docs/overhaul/` 里。新电脑上 clone 两个仓库、装好工具、登录 GitHub，就能接着做。拷本机文件只是为了留历史，不是必需的。

**东西在哪**

| 东西 | 现在在哪 | 新电脑上怎么办 |
|---|---|---|
| 网站代码 | GitHub `willyuan24-source/baylink-web`（公开） | clone |
| API 代码 | GitHub `willyuan24-source/baylink-api`（公开；店主 Windows 上的文件夹叫 `baylink-backend`） | clone |
| 这套交接文件 | 合并后在 baylink-web 的 `docs/overhaul/`；店主电脑上的工作副本是 `C:/Users/willy/opus-qa/overhaul/kit/` | 跟着 clone 过来 |
| 审计报告、缺口表、计划核心（脱敏版） | `docs/overhaul/reference/` | 跟着 clone 过来 |
| 私有笔记 `C:/Users/willy/opus-qa/**`（MASTER-PLAN、w1-lanes、lane 目录、审计证据和截图、评测结果、测量脚本） | 只在店主的 Windows 电脑 | 不是必需。想留历史：把 `opus-qa/overhaul` 和 `opus-qa/audit-1013` 打包，私下拷过去（U 盘或私有云盘），**不要放进公开仓库**（里面有没脱敏的内容） |
| lane worktree `C:/Users/willy/wt/**` | 只在店主电脑 | 不用拷。合并过的都在 GitHub；新电脑上重新建 worktree |
| 唯一没推到 GitHub 的分支 `claude/web-cnt-hotfix-2`（Thrill-O-Ween 标"已取消"） | 只在店主电脑 | 换电脑前请队长把它推成一个不开 PR 的分支；不推就丢（改动很小，也能重做） |
| Claude 的记忆和聊天记录 | 店主电脑上的 Claude 目录，按电脑和账号分开 | 不会跟过去。新会话读 `docs/overhaul/README.md` 就够 |
| 密钥 | Render、Vercel 后台；评测 key 文件只在店主电脑 | 不经过 git。后台设置不用动。评测 key 文件由店主在新电脑上重新建（放在所有仓库之外），只告诉 Claude 放在哪，不贴内容 |

**Mac 上要装的**
1. Git（终端里 `xcode-select --install`）和 GitHub CLI（`brew install gh`），然后 `gh auth login`，用店主自己的 GitHub 账号在浏览器里登录。
2. Node.js 24（两个仓库的 `package.json` 都写 `"node": "24.x"`；可用 nvm：`nvm install 24`）。每个 clone 和 worktree 里跑 `npm ci`。
3. Google Chrome（截图和线上只读检查用）。
4. Claude 桌面版（批量跑 lane 的 Workflow、PR 自动合并、用量工具都在桌面版里），或者 Claude Code 命令行版。
5. 建一个文件夹，例如 `~/baylink`，在里面跑 `gh repo clone willyuan24-source/baylink-web` 和 `gh repo clone willyuan24-source/baylink-api`。

**新账号或新电脑的第一次会话**
1. 在 `~/baylink` 这种中性文件夹里开会话。第一句："读 ~/baylink/baylink-web/docs/overhaul/README.md，然后按 HANDOFF.md 继续"。
2. 依次读 `README.md` → `HANDOFF.md` → `ROADMAP-8-9.md`。
3. `gh auth status`：确认登录的是店主的 GitHub 账号。
4. 查线上：`curl -s https://www.baylink.us/release.json` 和 `curl -s https://baylink-api.onrender.com/api/health`，再做第 9 节第 1 步。
5. 看用量（桌面版 `get_usage`，命令行 `/usage`），问店主这个账号的周上限。
6. 按 `NEXT-LANES.md` 开下一条 lane。

### Details for the next Claude (English)

**What lives where.** Code: both GitHub repos (public). Kit: `docs/overhaul/` in baylink-web once the docs PR merges (sanitized history in `docs/overhaul/reference/`). Not on GitHub: the owner's Windows notes `C:/Users/willy/opus-qa/**` (MASTER-PLAN, w1-lanes, lane dirs, audit evidence and screenshots, eval outputs, the capture/probe scripts), lane worktrees `C:/Users/willy/wt/**`, Claude memory and transcripts, and the eval-key file. None of these is essential once the kit is merged. Optional, private only: a zip of `opus-qa/overhaul` and `opus-qa/audit-1013`. The one unpushed branch is `claude/web-cnt-hotfix-2` (the held H01 commit); push it as a branch without a PR before the move, or redo it.

**Path mapping** (Mac example; any root works):

| Owner's Windows PC | New Mac |
|---|---|
| `C:/Users/willy/OneDrive/Desktop/baylink-web` | `~/baylink/baylink-web` (a fresh clone: keep its own working tree on a clean `main`, work only in worktrees) |
| `C:/Users/willy/OneDrive/Desktop/baylink-backend` | `~/baylink/baylink-api` |
| `C:/Users/willy/wt/claude-<slug>` | `~/baylink/wt/claude-<slug>` |
| `C:/Users/willy/opus-qa/overhaul/` (lane dirs, shots, logs) | `~/baylink/opus-qa/overhaul/` (create it; private, never inside a repo) |
| `C:/Users/willy/opus-qa/audit-1013/`, `MASTER-PLAN.md` | `docs/overhaul/reference/` (`REPORT-1013.md`, `gaps-1013.json`, `PLAN-CORE.md`); re-measure gaps |
| `C:/Users/willy/opus-qa/overhaul/kit/` (working copy) | edit `docs/overhaul/` in a docs worktree directly |
| `C:/Program Files/Google/Chrome/Application/chrome.exe` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| `export PATH="$PATH:/c/Program Files/GitHub CLI"` | not needed (Homebrew puts `gh` on PATH) |

**Windows-only assumptions and how to adapt them.**
- Lane runner (`lane-runner-w5.workflow.js`): pass `args.paths` (`qa`, `web`, `api`, `wt`, `kit`; `LANE-TEMPLATE.md` §3). When `opus-qa` files are missing, its agents read `kit/reference/` and re-measure. The private Windows copy of the runner stays on the old PC.
- `capture2.mjs` and the audit probes (`site-audit-1007/work/*`) are in `opus-qa`, not on GitHub. If copied over, change their `CHROME` constant to the Mac path and the default `OUT` folder. If not, a lane writes a small headless-Chrome (CDP) or Playwright capture script in its lane dir and reports `coverArea` and `realPhotoArea` separately (RC-31).
- Process cleanup: the PowerShell `Get-CimInstance … Stop-Process` line in §4 becomes `pkill -f "wt/claude-<slug>/"` (your own worktree path only; never a broad pattern such as `node` or `vite`); a port: `lsof -ti tcp:<port> | xargs kill`.
- §4 merge script: drop the `export PATH` line and use the Mac paths above; logs go to `~/baylink/opus-qa/overhaul/lanes/<KEY>/`.
- Line endings: api source files are committed with CRLF. Leave `core.autocrlf` unset on the Mac so files stay as committed; keep using CRLF-safe edits.
- `npm ci` EPERM is a Windows file-lock problem; on a Mac it is rare, but still stop your own preview servers first.
- Workflow scripts from the old sessions (`C:/Users/willy/.claude/projects/…/workflows/scripts/`) do not move; the kit's runner replaces them. The lean re-audit workflow must be rebuilt from `ROADMAP-8-9.md` §5.1 if it was not copied.

**Secrets never travel through git.** Render and Vercel env stay in their dashboards (nothing to move). The owner re-creates the eval-key env file on the new machine in a location outside every repo, tells Claude only where it is, and that location goes into private notes, never into the kit or a PR body. Never paste keys into chat.

**First-session checklist (new account or new machine).** Start in a neutral folder (`~/baylink`); read `README.md` → this file → `ROADMAP-8-9.md`; `gh auth status` (the owner's GitHub account); run §9 step 1 (live `release.json`, `/api/health`, open and recent PRs, remote `claude/*` branches); check usage and ask the owner which weekly cap applies to this account; open the next lane from `NEXT-LANES.md`.

---

## 中文摘要（先读这一段）

**网站**：BAYLINK（https://www.baylink.us），给湾区华人家庭的三语网站（简体 / 繁体 / 英文）。定位："湾区去哪、怎么办 · 有来源的中文答案"。AI 助手叫 BayBay。

**目标**：按 10-07 审计的评分标准，每个维度做到 8–9 分。最近一次审计（10-13）是 **7.0**。路线图见 `ROADMAP-8-9.md`。

**分工**：Claude 写代码、开 PR、CI 跑的时候开自动合并（squash）。GPT 只做内容核对。店主做决定、改 Render/Vercel 设置、补真实内容。店主要做的事和日期，见 `ROADMAP-8-9.md` 第 0 节"店主日程"。

**现在的状态（10-13 16:30）**
- 网站：WEB-FIX5（web #38）09:40 合并，约 09:45 上线。
- API：API-FIX5（api #42）10:34 合并，已上线。它的首句提速只在本地测过；线上 10 次实测还没做（要店主同意，≤$0.25）。
- 没有在跑的 lane，两个仓库都没有开着的 PR（16:10 查过）。
- 周用量 **45%（16:15），离 55% 还剩约 10%**。写和复核这套 kit 本身也在用额度。本周到 10/19（周一）05:00 重置。

**接手后先做的事**（详见英文第 9 节）
1. 先查线上实时状态（PR、线上版本、分支、用量）。查到的和本文件不一样时，以查到的为准。
2. 店主同意后（≤$0.25），对 API-FIX5 做线上抽测：10 次首句、3 条急症说法、面板上 BayBay 的剩余次数。首句中位超过 3 秒，交给 API-BB-4B。
3. 用中文给店主一张决定卡：Thrill-O-Ween、H07 方案、/this-month 改 301、R1 期间冻不冻结、BayBay 新 key 的切换日（10/23）、店主安全事项。有日期的事见 `ROADMAP-8-9.md` 第 0.1 节。
4. 本周余量里只做 5A 小 lane：CNT-HOTFIX-2（合并后跑 API-SYNC-3a）、API-OPS-KEY（10/22 前合并）、店主选好方案后的 WEB-HOLDOUT（合并后马上跑 API-SYNC-3b）；用量仍 ≤50% 再开 CNT-SUPPLY-2。把这套 kit 发到 `docs/overhaul/`（一个只改文档的 PR）。
5. 10/19 05:00 重置后，按 `NEXT-LANES.md` 开 Wave 5 的 5B、5C 两批（同时 ≤7 条），合并后做一次精简复审。10/21 提醒店主查 Console，10/23 提醒换 key。

**和店主说话**：中文，短句，结论先行。店主说"继续"，就是按本文件往下做。

---

## English details

### 1. Where everything is

**Repos and live services**

| What | Where | Deploys |
|---|---|---|
| Web (React 18 + Vite + Tailwind, static prerender + SPA) | github.com/willyuan24-source/baylink-web (public) | Vercel, from `main`. Live: https://www.baylink.us. Deployed commit: https://www.baylink.us/release.json |
| API (Express + MongoDB; BayBay in `lib/baybay*.js`, `lib/anthropic*.js`, `lib/aiGovernance.js`, `lib/aiBudget.js`) | github.com/willyuan24-source/baylink-api (public) | Render, from `main`. Health and deployed commit: https://baylink-api.onrender.com/api/health. BayBay state: https://baylink-api.onrender.com/api/ai/baybay-capabilities |
| 3D world `/opus-bay` | inside the web repo, `src/opus-bay/**` | Ships with web. **Owned by a separate Claude session ("Opus session"). Never edit it.** |

Both `main` branches are protected: the `check` CI job must pass and the branch must be up to date. Web CI has `site`, `opus` and `release` jobs plus the aggregate `check` (20–35 min). Vercel previews are off for `claude/*` branches, so every pre-merge check is a local build + `vite preview`.

**Local paths (owner's Windows machine)**

| Path | What | Rule |
|---|---|---|
| `C:/Users/willy/OneDrive/Desktop/baylink-web` | Owner's web checkout (old, has uncommitted files) | Only `git fetch` and `git worktree add`. Never touch its working tree, never reset or stash there |
| `C:/Users/willy/OneDrive/Desktop/baylink-backend` | Owner's api checkout | Same |
| `C:/Users/willy/wt/claude-<slug>` | Our lane worktrees (one per lane), branch `claude/<slug>` | Work only here. Real `npm ci`, no `node_modules` junctions |
| `C:/Users/willy/wt/audit-1011-web`, `audit-1011-api` | Read-only code copies for auditors | Do not develop in them |
| `C:/Users/willy/opus-qa/overhaul/` | Private notes: `MASTER-PLAN.md`, `w1-lanes.md` (every lane brief so far), `HANDOFF-*.md` (chronological, superseded by this file), `batch-runner.workflow.js`, `lane-runner-w5.private.workflow.js` (private copy of the runner), `api-stack-tips.txt` | Read freely. Not in git |
| `C:/Users/willy/opus-qa/overhaul/lanes/<KEY>/` | Per lane: `RESUME.md`, `PR.md` (PR body), logs, probes | Lane agents write here |
| `C:/Users/willy/opus-qa/overhaul/shots/<KEY>/{before,after}/…` | Screenshots per lane | |
| `C:/Users/willy/opus-qa/overhaul/eval/` | BayBay eval outputs (`engine-summary.md`, runs) | |
| `C:/Users/willy/opus-qa/audit-1013/` | Latest audit: `REPORT-1013.md`, `gaps.json` (H01–H79), lens dirs `<LENS>/{findings.json,notes.md,verify/}` | Evidence for every H id. Short H titles are in the `ROADMAP-8-9.md` appendix |
| `C:/Users/willy/opus-qa/audit-1011/`, `site-audit-1007/` | Earlier audits. `site-audit-1007/REPORT-1007.md` §2 is the scoring rubric; `capture2.mjs` and `work/<LENS>/*` are the measuring tools | |
| `C:/Users/willy/opus-qa/overhaul/kit/` | This kit (working copy) | |
| `C:/Users/willy/.claude/projects/C--Users-willy-baylink-opus/b22477a8-aba6-4f04-b881-741d10ae82b8/workflows/scripts/` | Workflow scripts from the last session: `baylink-wave3a-wf_53794899-ac0.js` (the Wave 3 lane runner that `lane-runner-w5.workflow.js` was built from), `baylink-audit-1013-wf_249d640b-483.js` (lean re-audit), `prod-check-w3-wf_74bedded-85f.js` (live check), `w3-visual-check-wf_ec4edf59-88e.js` | Same Windows user, so readable from a new account. If not, use the kit's runner |

**Do not touch, ever**: `C:/Users/willy/.codex/worktrees/*` (GPT/Codex), `C:/Users/willy/baylink-opus` (Opus session), the old `wt/w4-*…w9-*` and `i4-*` worktrees (not ours), `src/opus-bay/**`, `tests/opus-bay-*`, `vite.opus.config.ts`, `vite.config.ts` `manualChunks`, `public/opus-bay/**` (reference only), `.github/workflows/*` (needs the owner's explicit OK), any `.env` or key file.

**Tools**
- `gh` is at `C:/Program Files/GitHub CLI`. In bash: `export PATH="$PATH:/c/Program Files/GitHub CLI"`.
- Desktop-app-only tools (deferred; load with ToolSearch): PR tools `mcp__ccd_pr__bind_pr`, `mcp__ccd_pr__set_auto_merge`, `mcp__ccd_pr__set_monitor`, `mcp__ccd_pr__get_status`; usage `mcp__ccd_session_mgmt__get_usage`; the Workflow tool. Outside the desktop app: `/usage` for usage, `gh pr merge --auto --squash` for auto-merge (it may also be refused; then the owner clicks merge), and run lanes without the Workflow tool as described in `LANE-TEMPLATE.md` §3.
- Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe` headless with its own user-data-dir and CDP port. The owner allowed Claude in Chrome (the owner's Chrome) for **read-only** live checks.
- The Opus session can be reached with `ListAgents` / `SendMessage` (for example to ask it to place the 9 held SF events or to add `explore` to its entry sources), but only when the owner agrees to each request.
- API files are CRLF. Use the Edit tool or CRLF-safe scripts.

**Public copy of this kit**
- Location: baylink-web `docs/overhaul/` (all kit files, including `reference/`). Also a Claude Artifact page with the Chinese summary for the owner (`artifact.html` in the kit; republish it after each wave).
- Canonical copy: until the first docs PR merges, `C:/Users/willy/opus-qa/overhaul/kit/`. After that, the copy on baylink-web `main`; the opus-qa kit is the working copy.
- After each wave (captain): edit the opus-qa kit → run the sanitize check below → copy the files into a fresh worktree `wt/claude-docs-kit-<mmdd>` from `origin/main` → one docs-only PR (squash, auto-merge) → republish the Artifact if there is one.
- A docs-only PR still runs the full web CI (20–35 min) and a Vercel production build. Do one kit PR per wave, not one per edit.
- Pointer for new sessions: `docs/overhaul/README.md` (the kit index) plus one line in the root `README.md` (`优化交接 / optimization handoff: docs/overhaul/README.md`). Do not add a root `CLAUDE.md`: the Opus session works in the same repo and would load it.
- Sanitize check before every publish (must print nothing; the pattern does not match its own text): `grep -rnE "env-file=[A-Za-z0-9~./]|wrkspc_[A-Za-z0-9]|sk-ant-[a-z0-9]|@(gmail|outlook|yahoo|qq|163)\.|[A-Za-z]:/Users/[^ )]*\.env" docs/overhaul/`. Then read the diff once for security details and private phone numbers.

**Never publish these as they are** (the owner wants "全部上传", so this list matters). Publish only sanitized versions:
- `audit-1013/REPORT-1013.md` §6 row 1, `audit-1013/gaps.json` H15, and finding I13-01 in `audit-1013/I18N-SEO-ENG-SEC/` (owner security tasks).
- The security row of `audit-1011/REPORT-1011.md`.
- The project memory notes under `C:/Users/willy/.claude/projects/*/memory/` (account and organisation details).
- Lane PR.md files with env-file commands: `lanes/API-BB-HELPERS/PR.md`, `lanes/API-BB-STREAM/PR.md`, `lanes/API-FIX5/PR.md`.
- In general nothing outside `kit/` has had a sanitize pass (MASTER-PLAN, w1-lanes, older HANDOFFs, the 10-07 and 10-11 reports, lens findings, lane dirs). Run the check above and read them before publishing any of them.

### 2. Current state (2026-10-13 ~16:30 PT; re-check with §9 step 1)

**Scores**: 10-07 5.4 → 10-11 6.03 → 10-13 **7.00**. No dimension at 8 yet. Highest 多语言 7.8, lowest 社区 5.5. 图文结合 6.4, 功能走通 about 7.0. See `ROADMAP-8-9.md` §1.

**Web PRs merged** (all squash unless noted):
- #14–#20 Wave 0. #21 ROUTES · #22 CNT-MEDIA · #23 TOKENS-A · #24 WEB-UI · #25 BB-STREAMPREP · #26 SHELL1 · #27 FEEDBACK · #28 ELDERS · #29 ACCOUNT · #30 IMAGES · #31 HOMEPREP · #32 SAVES.
- #33 Wave 2 (EVENTS + GUIDES + BB-UI + SHELL2 + CNT-EVENTS) · #34 CNT-HOTFIX (without Thrill-O-Ween).
- #35 Wave 3 (CNT-GUIDES, DETAIL, DATA-SPLIT, HOME, SEO-I18N, SECONDARY, PLAN, VISUAL-SYS).
- #36 Wave 4 (CNT-SUPPLY, FRESH2, COMMUNITY, BB-UI-2, PLAN-DATA, POLISH).
- #37 WEB-FIX4 (`a0ea7e61`).
- #38 WEB-FIX5 (merged 16:40Z = 09:40 PT, `c8debf48`; **live**: `release.json` showed it at 10:03 PT, builtAt 16:44Z). It includes the web half of the H10 deploy order: the BayBay panel reads `/api/ai/usage` `baybay ?? top level`.

**API PRs merged**: #19–#28 Wave 0 · #29 NOTIFY-SEC · #30 FRESH-TRIAGE (`SOURCE_TRIAGE` off by default) · #31 ENGINE v2 · #32 STREAM · #33 HELPERS · #34 CUTOVER (BayBay live on v2, daily $ caps, pause mode, alerts) · #35/#36 HOTFIX · #37 BB-QUALITY · #38 API-SEC · #39 API-SYNC · #40 API-STATUS · #41 API-SYNC-2 (`188d957`) · #42 API-FIX5 (`d9bae34`, merged 17:34Z = 10:34 PT; **live**: `/api/health` showed it at 16:10 PT).

**API-FIX5 (#42)** closes H11, H17, H39 and the code parts of H03, H10, H38, H72. Full `npm test` 1907/1907, `npm audit` 0. Its public PR body was sanitized (placeholder for the key file; checked 16:10). The paid eval (≤$2) did not run because the permission system refused reading the eval key file; the commands are in the private `lanes/API-FIX5/PR.md` for the owner. **The post-deploy live check is not recorded yet** (nothing in `lanes/API-FIX5/` as of 16:10): 10 live questions for lead p50, 3 of the audit's emergency phrasings, the panel's BayBay remaining count; ≤$0.25 with the owner's OK (§9 step 3). Its local latency benchmark cut the server time before the model call from 591 to 318 ms; the audit measured 1.75 s of server time in a 5.9 s live lead p50, so live p50 after FIX5 is probably still about 4–4.5 s (see §8 #3 and `NEXT-LANES.md` API-BB-4B).

**Held on purpose, local only**: web branch `claude/web-cnt-hotfix-2` (`3bc0a409`) marks Thrive City Thrill-O-Ween as cancelled. It exists **only on this machine** (GitHub returns 404 for it), checked out in the worktree `C:/Users/willy/wt/claude-web-cnt-hotfix` (not a `…-hotfix-2` folder). It is lost if the machine changes; the captain may push it as a branch with no PR to keep it. The owner chose to keep the event up for now. The commit also makes `tests/opus-bay-w6-s-venues.test.ts` fail (that test pins the 10/24 event as valid in the 3D world, and we may not edit opus tests). Ship it only after the owner says so and either the owner approves the opus-test change or the Opus session makes it. The event is on 10/24; after that it is a past event and the P0 goes away by itself, so the real risk is families travelling to it before 10/24.

**Content held from the public catalogs**: 9 SF events in `src/data/public-catalog-holdout.ts` (`WORLD_IMPORT_PENDING`). The opus test W6-S1 requires a venue decision by the Opus session for every SF event in `public/planner-catalog.json`. This is gap H07; see `NEXT-LANES.md` WEB-HOLDOUT.

**Worktrees**: many finished `C:/Users/willy/wt/claude-*` worktrees remain from merged lanes. Deleting worktrees needs the owner's explicit OK (the classifier blocked it before). Disk is no longer the limit (10-13: about 353 GB free, 63% used); CPU and memory load from parallel builds and tests is.

### 3. Operating model

1. **Lane** = one scoped job = one worktree `C:/Users/willy/wt/claude-<slug>` + branch `claude/<slug>` + lane dir `lanes/<KEY>/` + a brief (in `w1-lanes.md` or `kit/NEXT-LANES.md`). Check that the slug's branch and worktree do not exist yet (`git branch --list claude/<slug>`); `worktree add -b` fails on an existing branch.
2. **Lane runner** = `kit/lane-runner-w5.workflow.js` (Workflow tool; explained in `LANE-TEMPLATE.md`). Per lane: implement → independent skeptical review → fix. Lane agents commit **locally only**: no push, PR, rebase, stash or worktree removal.
3. **Captain** = the main session. It pushes, opens PRs, merges, integrates and talks to the owner.
4. **Integration branch**: when 3+ web lanes finish together, one integration agent stacks them on fresh `origin/main` in a worktree `wt/claude-w<N>-int` (branch `claude/w<N>-int`). It cherry-picks each lane's non-regenerate commits in merge order, tags segments `w<N>int/<KEY>-start|end`, logs every conflict in `lanes/W<N>-INT/conflicts.log`, runs **one** full gate and one final regenerate commit, and writes `lanes/W<N>-INT/{RESUME,INTEGRATION,PR}.md`. The captain pushes and opens one PR (squash). Examples: `lanes/W3-INT/`, `lanes/W4-SHIP/`.
5. **One full gate per lane.** Iterate with targeted tests. Run `npm run check` (+ `npm run test:opus` when touching OPUS-contract files) once on the final tip; CI repeats it.
6. **Regenerate last.** Generated files are never hand-edited: `src/data/generated/**`, `vercel.json`, `public/sitemap.xml`, `public/*catalog*.json`, `public/baybay-guides*.json`, ratchet baselines. After the final rebase: `npm run pretest && npm run build && npm run ratchet:update`, revert date-only noise, commit "Regenerate generated files" as the last commit, then the one full gate on that tip.
7. **Budgets only go down.** Per-route JS ceilings in `scripts/verify-release.mjs` and the style ratchet only ratchet down. A lane that shrinks a route lowers its ceiling. Never `--allow-increase`. Home route graph ≤220 KiB (now about 191).
8. **OPUS contract** (MASTER-PLAN §3.0 + RC-8). Breaking it fails CI's `opus` job:
   - `HomeDiscovery` keeps `a[href="/opus-bay?from=home"]` (text /3D 旧金山/ and /独立 3D 体验/, en /3D San Francisco/) with a full-page load and no `/play` link; an **eagerly rendered** client-side `<Link to="/calendar">` ("按日历看"); and its props `onAskBayBay`, `onBrowseCommunity`, `today`.
   - `SiteNavigation` keeps `a[href="/opus-bay?from=nav"]` "3D 旧金山", `aria-current="page"` on `/opus-bay` and `/play`, and accepts the props `active`, `category`, `homeActive`, `user`, `notification`, `notificationCount`, `onCreate`, `onAsk`, `onAccount`. Its desktop 更多▾ content stays in the DOM when the menu is closed (RC-8 ii).
   - `src/App.tsx` keeps exactly `<Route path="/play" element={<PlayRedirect />} />`. `scripts/prerender.tsx` keeps the `play.html` writeFile line; `/play` stays out of the sitemap.
   - `AttractionExplorer` keeps its 3D entry (`tests/opus-bay-attraction-entry.test.tsx`). `Home3DTile` renders eagerly (RC-8 i; a `React.lazy` section renders only its fallback in prerender).
   - `simplifySearch` (`src/i18n/locale.ts`) stays **synchronous** (RC-8 iii). `src/opus-bay/data/sf/placeSearch.ts` and `src/lib/search-synonyms.ts` both call it.
   - Run `npm run test:opus` when touching `App.tsx`, `prerender.tsx`, `vite.config.ts`, `src/i18n/*`, `SiteNavigation`, `HomeDiscovery`, `AttractionExplorer`, home sections, or `src/lib/search-synonyms.ts`.
9. **Data honesty.** Never change `verifiedAt` on existing items (D12). New items may set `verifiedAt` to the day the official page was actually read. Every new fact gets a ledger row in `docs/source-reads-2026-10.md` (URL, date, quote). No invented times or prices. No AI images for events, offers or openings. No image downloads without an owner-approved list. Hide counts under 3. A `verifiedAt` set from an agent's read means "an agent read the official page that day"; the audit counts only editor checks as 人工复核 (0/668 on 10-13), so page copy must never call an agent read 人工核对 or 编辑核对.
10. **API contracts are additive**; old clients keep working. API merges before the web that depends on it, **except** when the web must first learn to read a new field (API-FIX5: web #38 first).
11. **Production is read-only** for Claude: no logins, posts, DMs, feedback, saves or emails. Block `/api/product-events` and `/api/client-errors` in scripted browsers. Live BayBay questions only within an owner-approved budget.
12. **After every content merge**, run the next API-SYNC-3 run (`NEXT-LANES.md`: 3a after CNT-HOTFIX-2, 3b right after WEB-HOLDOUT, 3c after CNT-SUPPLY-2, 3d after the Wave 5 web PRs). The API keeps copies of the web catalogs; unknown ids 404 on saves and BayBay cannot recommend them.
13. Commit messages in English, repo style, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR body = `lanes/<KEY>/PR.md`: first line = PR title (≤110 chars), English body, Chinese 改了什么 / 怎么证明 / 还剩什么, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. **Both repos are public, so sanitize every PR body before `gh pr create`**: replace any env-file path with `<owner eval-key env file>`, then `grep -nE "env-file=|C:/Users" lanes/<KEY>/PR.md` and check each hit (other local paths are fine; key-file paths and account ids are not). Keep the unsanitized PR.md for the owner.

### 4. Merge procedure (captain)

Web example; for the api skip pretest/build and gate with `npm test` + `npm audit --audit-level=high`.

```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
set -e
git -C C:/Users/willy/OneDrive/Desktop/baylink-web fetch origin
cd C:/Users/willy/wt/claude-<slug>
git status --short            # must be clean
git branch backup/<slug>-pre-rebase HEAD
# Drop the old final regenerate commit first (it is rebuilt at the end anyway):
git log -1 --format=%s | grep -q "^Regenerate generated files" && git reset --hard HEAD~1
# Rebase onto the new main. A regenerate commit in the middle of the stack: resolve by taking main, then --skip it.
# <base> = the commit the lane branched from (for a stack: the old upstream tip; record it BEFORE the squash-merge).
git rebase --onto origin/main <base> claude/<slug>
# Or: git reset --hard origin/main && git cherry-pick <non-"Regenerate generated files" commits in order>
```

Conflicts:
- `scripts/check-editorial-styles.mjs` scope list: keep both sides.
- Generated files, ratchet baselines, `vercel.json`, `public/*`: take main (`git checkout --ours`, which during a rebase is main), then regenerate.
- A commit that becomes empty (regenerate-only): `git rebase --skip` / `git cherry-pick --skip`.
- Real source conflicts: read both intents and merge by hand. Never resolve by dropping the other lane's behaviour.

Then (regenerate → commit → one gate on that tip):
```bash
# Stop leftover processes of THIS lane only (PowerShell), else npm ci fails with EPERM:
#   Get-CimInstance Win32_Process | ? { $_.CommandLine -like '*wt\claude-<slug>*' -or $_.CommandLine -like '*wt/claude-<slug>*' } | % { Stop-Process -Id $_.ProcessId -Force }
npm ci                                    # whenever package-lock changed on main
npm run pretest && npm run build && npm run ratchet:update
# Revert pure date noise before committing:
#   public/discovery-context*.json when only checkedAt changed; src/data/generated/home-catalog.json when only generatedAt changed.
#   Line-ending-only changes: git checkout -- <file>.
git add -A && git commit -m "Regenerate generated files" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
npm run check > C:/Users/willy/opus-qa/overhaul/lanes/<KEY>/check-merge.log 2>&1
npm run test:opus > C:/Users/willy/opus-qa/overhaul/lanes/<KEY>/opus-merge.log 2>&1   # if OPUS-contract files changed
git status --short                        # must still be clean; if the check changed files or failed, fix, regenerate, recommit
# Sanitize the PR body (§3.13): public copy with placeholders, then check it
cp C:/Users/willy/opus-qa/overhaul/lanes/<KEY>/PR.md C:/Users/willy/opus-qa/overhaul/lanes/<KEY>/PR.public.md
#   edit PR.public.md: env-file paths -> <owner eval-key env file>
grep -nE "env-file=|C:/Users" C:/Users/willy/opus-qa/overhaul/lanes/<KEY>/PR.public.md || true   # read every hit
git push -u origin claude/<slug>          # --force-with-lease if the branch already existed
gh pr create -R willyuan24-source/baylink-web --base main --head claude/<slug> \
  --title "<line 1 of PR.md without #>" --body-file C:/Users/willy/opus-qa/overhaul/lanes/<KEY>/PR.public.md
```

Right after `gh pr create`, while CI is still running:
1. `bind_pr` (PR URL).
2. `set_auto_merge` with method **squash**. Never use rebase-merge: GitHub cancelled it on a PR with more than 100 commits. Outside the desktop app: `gh pr merge <n> --auto --squash`.
3. `set_monitor` (auto-fix). The app wakes you if CI fails or the branch falls behind. Do not poll CI yourself.

If auto-merge cannot be enabled (the PR is already CLEAN, so the tool refuses), **ask the owner to click "Squash and merge"**. Direct `gh pr merge` is refused by the permission system, and you must not try to get around that. Or push a real new commit (CI re-runs) and enable auto-merge while CI runs.

After the merge:
- `curl -s https://www.baylink.us/release.json` must show the new commit (Vercel takes about 15 min). `curl -s https://baylink-api.onrender.com/api/health` for the api.
- If Vercel never deploys the merge (happened with #34), ask the owner to Redeploy in Vercel; the next merge would also carry it.
- Spot-check the changed pages (phone 390 and desktop 1440, three locales).
- Content merge → start the next API-SYNC-3 run.
- Delete nothing without the owner's OK.

### 5. Usage pacing and machine limits

- **This week: total weekly usage ≤55%.** The owner reserves 45%. The weekly reset is Monday about 05:00 PT (next: 10/19 05:00). At 16:15 on 10/13 it was **45%**, so about 10% is left, and writing and reviewing this kit used some of it. A new Claude account has its own weekly quota: ask the owner which cap applies. Without a new instruction the ≤55% rule continues after 10/19.
- Check `get_usage` (or `/usage`) before launching anything and whenever a workflow notifies you. At ≥50%: no new lanes; only merges and necessary fixes.
- Rough weekly cost: S lane 0.5–1%, M lane 1.5–2%, L lane 3–4%, integration 1–2%, lean re-audit 4–6%, full re-audit 10–15%. In a 5-hour window, 6 lanes use 30–45% of the window per hour.
- **≤7 concurrent lanes.** Prefer fewer; launch small lanes first.
- The machine is shared: a full test suite under load can take hours, time out, or kill test files at about 20 ms with no assertion. Rerun those files alone and record it. Never count a real failure as a pass.
- One full `npm run check` per lane, on the final tip.
- Kill processes only by your own worktree path or your own ports. On 10-12 at 03:46, one lane's broad process filter killed six other lanes' checks.
- Ports: each lane gets a vite preview port and a Chrome CDP port. Used up to 5846/9446 (WEB-FIX5). Wave 5 uses 5847–5858 / 9447–9458 (table in `NEXT-LANES.md`).
- Memory and CPU are the real limits now (a transient "paging file too small" happened under load). Disk has room (about 353 GB free on 10-13).
- Usage limits can cut an agent off mid-task. Every lane keeps `lanes/<KEY>/RESUME.md` current and commits every 20–30 min.

### 6. Pitfalls learned (all of them)

1. Sub-agents cannot run `git rebase --onto` (the guard refuses). The captain rebases; lane agents cherry-pick at most.
2. Paid BayBay evals that load the owner's eval-key env file are refused for sub-agents, and once for the main session. Write the exact command into PR.md for the owner. Never bypass, never open or print the file. Its location is in the private notes, not here, and it never goes into a public PR body (§3.13).
3. Workflow sub-agents cannot receive messages mid-run. To change course, stop the whole workflow (TaskStop); files and commits stay.
4. Do not use `resumeFromRunId` for pipeline workflows: it re-runs finished lanes. Relaunch only the unfinished lanes with `base: "worktree exists — RESUME from lanes/<KEY>/RESUME.md; do NOT rebase"`.
5. A check log that ends without an `EXIT` line was cut off. Rerun it; don't diagnose it.
6. Interrupted builds leave dirty generated files. Restore them (`git checkout -- src/data/generated public vercel.json`) and regenerate later.
7. Before `npm ci` in an old worktree, stop that lane's leftover `vite preview` / `esbuild` processes, or it fails with EPERM. Run `npm ci` again when main added a dependency (for example `sharp`).
8. Never pipe `git rebase` output into another command: `set -e` no longer catches the failure. Record the old upstream SHA of a stacked branch before its parent is squash-merged (`api-stack-tips.txt` has examples).
9. Rebase-merge auto-merge was cancelled by GitHub on the Wave 2 PR (#33, more than 100 commits). Always squash.
10. Once a PR is CLEAN, `set_auto_merge` cannot be enabled any more. Enable it while CI is still running.
11. `gh pr merge` is refused by the permission classifier ("merge without review"). The owner clicks merge in that case.
12. Vercel sometimes does not deploy a merged commit (#34). Always confirm `release.json`.
13. 429 errors in a local browser after a night of testing were our own IP being rate-limited, not a site bug. Re-check in a fresh browser or the owner's Chrome before reporting.
14. Date-dependent tests can turn red on a new calendar day with no code change (`tests/date-guard.test.tsx` failed on 10/13). Pin "today" in tests.
15. The security classifier blocks: opening the Render environment page (live secrets), editing CI workflows, and changing production diagnostic or security behaviour without the owner's OK. Stop and ask.
16. The stash is shared across all worktrees and sessions. Never use a bare `git stash`. Prefer a WIP commit.
17. Never touch the owner's checkouts, `.codex/worktrees/*`, `baylink-opus`, old non-Claude worktrees, `src/opus-bay/**` or `tests/opus-bay-*`.
18. Cancelling Thrill-O-Ween breaks an opus test (see §2). Holding 9 SF events breaks BayBay and saves for them (H07). Both need the Opus session or an owner decision.
19. Deploy order: web must read `value.baybay ?? value` from `/api/ai/usage` before API-FIX5 deploys (done: #38 went live before #42).
20. API-SYNC must follow every content merge, including GPT's, or saves 404 and BayBay misses the new items.
21. CNT lanes: one new dated batch file + its `-en.json` pair + overlay fields; ledger rows for every new fact; no image downloads (write `image-candidates.md` for the owner instead).
22. capture2 counts a TypeCover as image area only through `[data-cover]`. Report `realPhotoArea` separately (RC-31). Otherwise the image metric is wrong by construction. (UI9-IMAGES 2026-10-21: TypeCover is gone; every cover is a picture, `[data-cover=type]` = 0.)
23. Generated single-line JSON conflicts on every rebase. Never resolve by hand; take main and regenerate.
24. Linkify phone numbers on the already-translated string, or /en paragraphs fall back to Chinese (RC-11).
25. Lazy-loaded home sections render only their fallback in prerender. Anything the OPUS contract needs must render eagerly (RC-8).
26. Messages from the owner that are relayed to sub-agents are not new tasks for them.
27. Both repos are public. Notes with sensitive details stay in `opus-qa/` (private), never in a commit. The files that must never be published as they are: REPORT-1013 §6 row 1, gaps.json H15, finding I13-01, the REPORT-1011 security row, the project memory notes, and the PR.md files of API-BB-HELPERS, API-BB-STREAM and API-FIX5 (env-file commands). See §1 for the full rule.
28. A content lane's process filter must never match other lanes' `npm run check` processes (see §5).
29. The PR title is the first line of PR.md. Strip `#`/`##`. If line 1 is `## Summary`, write a real title.
30. Old merged worktrees take space (about 1.7 GB each built). Ask the owner before deleting any.
31. `ANTHROPIC_USE_UNTIL` accepts only `YYYY-MM-DD` or a full ISO time with `Z` or an offset (`2027-04-19T00:00:00Z`, `2027-04-18T17:00:00-07:00`), no spaces. Any other value makes the API treat Claude as unavailable: BayBay and the other AI features stop at once, with no advance banner (`lib/anthropicBaybay.js` `anthropicAvailable`, `lib/aiBudget.js` `aiUntilOf`).
32. From 7 days before `ANTHROPIC_USE_UNTIL`, every page shows "AI 助手预计…起暂停" (`lib/aiBudget.js` `scheduledPause`). With today's value that starts 10/22 17:00 PT.
33. The held hotfix-2 branch is local only (§2). Lane slugs must not reuse an existing branch name (§3.1).

### 7. Owner decisions (binding until the owner changes them)

- Claude codes, opens PRs and enables auto-merge (squash) after a green local gate. The owner clicks merge only when auto-merge cannot be enabled.
- GPT does content verification only. GPT must not edit hot files without the captain.
- "凡客观有用的都可以做": do whatever is objectively useful; ask only about big problems.
- Content work covers today onward; past dates are not back-filled. (The 10-09 rule about 10/10–10/12 has expired.)
- The R0 freeze no longer blocks merges (owner, 10-09). Whether D23's R1 freeze applies once public R1 starts is **not decided** (owner card).
- **Images (10-08)**: an organiser's own official images may be used on that same event's coverage, labelled 官方图 with a source link, with a takedown contact on About. Every download batch is listed (filename, source URL, size) in an `image-candidates.md` and approved by the owner **before** downloading. Rights templates and publisher outreach are needed only for non-event photos (guides, places).
- Thrive City Thrill-O-Ween (cancelled by the organiser) **stays up for now**. Do not take it down anywhere until the owner says so.
- Owner security tasks (see private notes) are the owner's. Remind, never block on them.
- BayBay runs engine v2. After 10/23 it continues on a **new Anthropic API key with about $1,000 of credit valid about 6 months**. The owner sets the Render env: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID` (only if the key is organization-scoped), `ANTHROPIC_USE_UNTIL` (new expiry or empty). Plan: `ROADMAP-8-9.md` §4.
- Weekly Claude usage ≤55% this week (the owner's current account).
- Claude may use the owner's Chrome (Claude in Chrome) for read-only live checks.
- Never log in, post or message on production.
- D3 says `/this-month` stays an alias until after R1; WEB-LINK-2 proposes the 301 now (audit H35). Owner card item; until answered, the 301 stays a separate last commit that can be dropped.

### 8. Pending owner items (put these on one Chinese card, each with a default)

| # | Item | Default if no answer |
|---|---|---|
| 1 | Owner security tasks (see private notes; audit H15) | Remind daily; security stays at about 7 |
| 2 | H01 Thrill-O-Ween: keep the page but label it "主办方已取消" and remove add-to-plan and .ics? Needs an OK for the opus test change, or the Opus session | Stays up; scored as P0 until it becomes a past event after 10/24 |
| 3 | BayBay new key: **switch the key and `ANTHROPIC_USE_UNTIL` together on 10/23** (the first day the new key works). Before that, check the Console (`ROADMAP-8-9.md` §4.2 step 0: balance, existing org limit, existing eval workspace, workspace id). Set R1 quotas (`AI_GUEST_BAYBAY_DAILY_LIMIT`, `AI_USER_BAYBAY_DAILY_LIMIT`), caps and alerts. Date format per §6 #31 | The "预计暂停" banner shows from 10/22 17:00; from 10/29 17:00 PT BayBay only gives site excerpts |
| 4 | H07: Option A (ask the Opus session to place the 9 SF events) or Option B (the API reads a full catalog; `/opus-bay` keeps the held file) | Option B after 10/19 |
| 5 | Daily rebuild: Vercel Deploy Hook + `VERCEL_DEPLOY_HOOK_URL` + `CRON_SECRET` (web `docs/daily-rebuild.md`); apex 307 → 308 + HSTS on the root (H16, H42). Was due 10/16 in MASTER-PLAN §6 | Date pages freeze on the last deploy day |
| 6 | `/this-month` → 301 now (H35) instead of after R1 (D3) | Yes, ship it in WEB-LINK-2 |
| 7 | R1: does D23's freeze apply once public R1 starts? Public R1 recruiting waits for H05, H07 and H04; friends in person are fine now | No full freeze: tester-hit fixes any time, other user-visible merges on Mondays with a note to the tester group |
| 8 | Consent to add unit tests to the release gate (H61) | Not added |
| 9 | `SOURCE_TRIAGE` on (after the dry run, ≤$0.10) + a named 48-hour reviewer + Wednesday reviews (GPT may do them) | 内容时效 stays about 6.5–7 |
| 10 | Thursday picks every week (Claude drafts on Wednesday night) | Labelled "本周末先看" |
| 11 | Images: approve each `image-candidates.md` download list (minutes; `lanes/CNT-SUPPLY/image-candidates.md` first). Rights template and outreach only for non-event photos. Weekly photo outing (optional) | 图文结合 stays about 7 |
| 12 | Community: 8–12 real posts per category (站长发布) + the two-account delivery test in production (G5, `docs/g5-production-checklist.md`, was due 10/14). Or hide the community (`COMMUNITY_VISIBLE`, after WEB-COMMUNITY-2 ships) | 社区 stays 5.5 |
| 13 | Notification emails: `NOTIFICATION_DELIVERY_ENABLED=true` turns on **all** outgoing email at once (member notifications, login alerts, the triage digest and the AI alerts; `lib/notifications.js`). It needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and a verified Resend domain, then `OWNER_DIGEST_EMAIL` / `AI_ALERT_EMAIL`. Run `docs/g5-production-checklist.md` first | No alert emails; the owner checks the Console weekly |
| 14 | Run the API-FIX5 paid eval (commands in the private `lanes/API-FIX5/PR.md`, ≤$2) and approve ≤$0.25 of live checks after deploy | Live check only |
| 15 | H58: how to shorten the 何时 cell (merge same-time sessions / 2 sessions on phone / 适合 as a chip line) | Merge same-time sessions |
| 16 | Library events "free" policy (about 34–43 events, H69) | Mark free only where the library's own policy row is in the ledger |
| 17 | Review the new official numbers lists from content lanes | Only already-sourced numbers ship |
| 18 | WEB-VISUAL-2 illustration set: approve screenshots before merge (risk of looking like a template) | Lane merges without the illustrations; the rest ships |
| 19 | Search Console + Bing verification and sitemap submit; free uptime monitor on `/api/health`, `/`, `/events`; optional Vercel Web Analytics / Speed Insights | Not done |
| 20 | The public bodies of api PRs #32 and #33 name the local eval-key env file (the name only, not its contents; #42's body was checked and has only a placeholder). Edit those bodies? | Leave them |
| 21 | A private GitHub repo for `opus-qa` notes and audits (so another machine or a cloud session can continue) | Notes stay on this PC only |
| 22 | Delete old merged `claude-*` worktrees | Keep |

### 9. The first things to do

1. **Re-check the live state (RC-38: start from live state, not the plan).** Trust these results over this file:
   ```bash
   # Windows Git Bash only: export PATH="$PATH:/c/Program Files/GitHub CLI"   (not needed on a Mac)
   for r in baylink-web baylink-api; do
     gh pr list -R willyuan24-source/$r --state open
     gh pr list -R willyuan24-source/$r --state merged --limit 5
     git ls-remote https://github.com/willyuan24-source/$r.git 'refs/heads/claude/*'
   done
   curl -s https://www.baylink.us/release.json
   curl -s https://baylink-api.onrender.com/api/health
   ```
   Then `get_usage` (or `/usage`). If a newer merge is missing from `release.json` after about 30 min, ask the owner to Redeploy in Vercel. Spot-check #38 once: `/events` (region chip row), home (长辈友好 circle), a pilot guide at 320 px with 特大 + 简洁, an opening (已开业), the BayBay panel (remaining count).
2. **Point the old entry points here** (captain, once): overwrite `C:/Users/willy/opus-qa/overhaul/HANDOFF-LATEST.md` with a two-line pointer to `kit/HANDOFF.md`; add the same pointer as the first line of `C:/Users/willy/opus-qa/HANDOFF-新Claude-BAYLINK优化.md`; update the baylink-web project memory entry (`C:/Users/willy/.claude/projects/C--Users-willy-OneDrive-Desktop-baylink-web/memory/`, the BAYLINK optimization note) to say "read opus-qa/overhaul/kit/HANDOFF.md first".
3. **API-FIX5 post-deploy live check** (#42 is live; not recorded yet as of 16:10): with the owner's OK (≤$0.25), ask 10 live questions and record the lead p50 (target ≤3 s; above 3 s → API-BB-4B owns it, `NEXT-LANES.md`); try 3 of the audit's emergency phrasings (911 card); confirm the panel shows BayBay's own remaining count. Write the results to `lanes/API-FIX5/live-check.md` (private) and one line into the next kit update.
4. **Owner card** (Chinese, ≤10 lines): §8 items 1–4, 6 and 7 first, each with its default. Point to the dated list in `ROADMAP-8-9.md` §0.
5. **This week's budget** (until 10/19 05:00, ≤55% in total; stop launching at 50%): batch 5A from `NEXT-LANES.md` — CNT-HOTFIX-2 (S, slug `cnt-hotfix-2`) then API-SYNC-3a, API-OPS-KEY (S, $0, merge before 10/22), WEB-HOLDOUT if the owner chose (then API-SYNC-3b at once), and CNT-SUPPLY-2 only if usage is still ≤50% after CNT-HOTFIX-2 merges (then API-SYNC-3c). Publish this kit to `docs/overhaul/` (§1) in one docs-only PR, with the `reference/` folder.
6. **From 10/19**: launch batch 5B, then 5C, from `NEXT-LANES.md` (≤7 concurrent), integrate the UI lanes through `claude/w5-int`, merge the api lanes one by one, then a lean re-audit (`ROADMAP-8-9.md` §5.1). Remind the owner about the BayBay key on **10/21** (check the Console) and **10/23** (switch day).

### 10. Ids used in the notes

- **D1–D26**: binding design decisions (MASTER-PLAN §0.2).
- **RC-1–RC-40**: critic review rules (end of MASTER-PLAN). They override the plan text.
- **G01–G108**: gap groups from the 10-11 audit (`audit-1011/gaps.json`).
- **H01–H79**: gap groups from the 10-13 audit (`audit-1013/gaps.json`). Current numbering; short titles in the `ROADMAP-8-9.md` appendix.
- **Lens finding ids** (for example `EVT13-01`, `BB-1013-04`, `GR-01`): in `audit-1013/<LENS>/findings.json`, with verifier verdicts in `verify/`.
- **R0 / R1 / R2**: tester rounds (friends in person; 20 households; 50–100 people). Friends in person are fine now. Public R1 recruiting waits for H05, H07 and H04 (REPORT-1013 §1).
