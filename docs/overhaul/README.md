# BAYLINK 全站优化 · 交接包

> 给接手的人：新的 Claude 账号、新电脑，或者店主自己。2026-10-13 16:30（湾区时间）更新。English summary at the end.
> 公开仓库里的位置：baylink-web 的 `docs/overhaul/`。

## 这是什么

BAYLINK（https://www.baylink.us）是给湾区华人家庭的三语网站（简体 / 繁体 / 英文）："湾区去哪、怎么办 · 有来源的中文答案"，AI 助手叫 BayBay。

从 10-07 起，按一份固定的评分标准（15 个加权维度，另加"图文结合""功能走通"）一轮一轮改版：Claude 写代码、开 PR、合并；GPT 只做内容核对；店主做决定、改 Render / Vercel 后台、补真实内容。

这个文件夹就是交接包。读完就能接着做，不需要以前的聊天记录，也不需要原来那台电脑。

## 最新分数

| 10-07 | 10-11 | 10-13（最新审计） | 10-13 之后 |
|---|---|---|---|
| 5.4 | 6.03 | **7.0** | WEB-FIX5（web #38）和 API-FIX5（api #42）已上线，估计约 7.2，待下次复审 |

还没有一个维度到 8。目标是每个维度 8–9 分：只靠代码约到 7.7，要到 8 还需要店主的内容、图片、社区和后台设置。路线见 `ROADMAP-8-9.md`。

## 5 步接着做

1. **先查线上**（`HANDOFF.md` 第 9 节第 1 步）：`release.json`、`/api/health`、两个仓库开着和最近合并的 PR。查到的比文件准。
2. **读文件**：`HANDOFF.md`（先看"换账号怎么接"和"在新电脑 / 新 Mac 上继续"），再读 `ROADMAP-8-9.md` 第 0 节。
3. **看用量**：问店主这个账号的周上限（这周 ≤55%，周一 05:00 重置；到 50% 不再开新 lane）。
4. **给店主一张中文决定卡**：按 `ROADMAP-8-9.md` 第 0.1 节的日程，每项带默认。
5. **开下一条 lane**：按 `NEXT-LANES.md`（本周是 CNT-HOTFIX-2 和 API-OPS-KEY），用 `lane-runner-w5.workflow.js` 跑，合并按 `HANDOFF.md` 第 4 节。

## 文件

| 文件 | 内容 |
|---|---|
| `HANDOFF.md` | 交接主文件：东西在哪、现状、工作规则、合并步骤、踩过的坑、店主决定和待办、接手后第一步、换电脑 |
| `ROADMAP-8-9.md` | 从 7.0 到 8–9：评分卡、每个维度的 8 分和 9 分标准、分阶段计划、店主日程、BayBay 新 key、复审方法、H01–H79 去向 |
| `NEXT-LANES.md` | 马上能开的 Wave 5 lane（slug、端口、批次、合并顺序）和 Wave 6 草稿 |
| `LANE-TEMPLATE.md` | 怎么写一条 lane、怎么跑一批、没有 Workflow 工具时怎么办 |
| `lane-runner-w5.workflow.js` | 批处理脚本（实现 → 独立复核 → 修复）；换电脑时用 `args.paths` 传新路径 |
| `artifact.html` | 给店主看的一页中文总结（Claude Artifact 页面） |
| `reference/REPORT-1013.md` | 10-13 审计报告（脱敏） |
| `reference/gaps-1013.json` | 10-13 缺口表 H01–H79（脱敏） |
| `reference/REPORT-1011.md` | 10-11 审计报告（脱敏） |
| `reference/PLAN-CORE.md` | 总计划的核心：决策 D1–D26、信息架构、评分目标、全局规则和 OPUS 契约、复审方法、Critic 规则 RC-1–RC-40 |

## 规则提醒

- 两个仓库都是公开的。这里不写密钥、key 文件的位置、账号邮箱、私人电话，也不写未修的安全细节；安全相关的一律写"店主安全事项（见私有笔记）"。
- 3D 世界 `src/opus-bay/**` 和 `tests/opus-bay-*` 属于另一个 Claude 会话，不要改。
- 不在生产环境登录、发帖、发私信。

## English summary

BAYLINK whole-site overhaul handoff kit. Read `HANDOFF.md` first: it supersedes every earlier handoff, and the live state you check (HANDOFF §9 step 1) beats it. Scores: 5.4 (10-07) → 6.03 (10-11) → 7.0 (10-13, latest audit); WEB-FIX5 (web #38) and API-FIX5 (api #42) shipped after that audit. Resume in five steps: check live state → read HANDOFF and ROADMAP §0 → check usage and ask the owner's weekly cap → give the owner a Chinese decision card → open the next lane from `NEXT-LANES.md` with `lane-runner-w5.workflow.js`. On a new machine (for example a Mac), follow HANDOFF "在新电脑 / 新 Mac 上继续", which has an English part. `reference/` holds sanitized copies of the 10-13 and 10-11 audit reports, the 10-13 gap list and the core of the master plan.
