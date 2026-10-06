# 主分支 CI 发布保护核验

记录时间：2026-10-06 08:29 UTC。此记录是本次 API 回读时的状态，后续发布仍需核对目标提交的 CI 与实际线上版本。

使用现有 Git Credential Manager 身份 `willyuan24-source`，凭据仅在进程内存中用于 `api.github.com`，没有输出或写入文件。两个仓库均为 public，当前身份均有 admin 权限。

| 仓库 | 操作前 main 状态 | 操作后 GET 核验 |
| --- | --- | --- |
| `willyuan24-source/baylink-web` | `protected=false`；保护接口 404 `Branch not protected`；rulesets 与 main rules 为空 | HTTP 200；`protected=true`；`strict=true`；必须通过 `check`；限定 GitHub Actions `app_id=15368`；`enforce_admins=true` |
| `willyuan24-source/baylink-api` | `protected=false`；保护接口 404 `Branch not protected`；rulesets 与 main rules 为空 | HTTP 200；`protected=true`；`strict=true`；必须通过 `check`；限定 GitHub Actions `app_id=15368`；`enforce_admins=true` |

创建保护前再次读取了 main、现有保护、rulesets 与 main rules，确认没有已有规则需要转换。仅配置严格 CI 检查与管理员适用；没有增加人工审批要求或费用。`required_pull_request_reviews` 与 `restrictions` 继续为空，`allow_force_pushes=false`、`allow_deletions=false`。以后必须先把拟发布提交推至工作分支，通过对应提交的 CI 后再更新 main。

实际 workflow 和 check-run 均确认任务名为 `check`，发布者为 GitHub Actions。前端 `Website checks` 执行 `npm ci`、`npm run check`、高危依赖审计；后端 `API checks` 还执行 `npm test`。

| 当前 main 提交 | 实际 CI 状态 |
| --- | --- |
| 前端 `9ccf6fe346316ff141ab9174a37c249b99bc14ef` | [`Website checks` 失败](https://github.com/willyuan24-source/baylink-web/actions/runs/37389181928) |
| 后端 `a50d9e53f75d744ed9e086dfd53d7a8a71224239` | [`API checks` 成功](https://github.com/willyuan24-source/baylink-api/actions/runs/37435232729) |

GitHub deployment 元数据证实：前端旧提交 `9ccf6fe346316ff141ab9174a37c249b99bc14ef` 在 2026-10-05 23:38:26 UTC 已由 `vercel[bot]` 成功部署至 Production，deployment ID `6871891095`，对应 [Vercel 部署地址](https://baylink-8an9gslly-willyuans-projects.vercel.app)。这说明保护启用前，失败 CI 的提交曾被部署。新增保护阻止后续未满足检查的 main 更新；该元数据不能证明所有部署途径都受 CI 限制。

本地没有发现 Vercel/Render 环境凭据或 Vercel CLI 项目关联，后端没有 GitHub deployment 记录，因此没有据此断言 Render 或 Vercel dashboard 的实际自动发布策略。当前前端 `vercel.json` 的 buildCommand 是 `npm run release:build`，仅 `opus-bay` 分支的 Git 部署被禁用；这些是仓库配置，不代替平台设置核验。

接口依据：[GitHub 官方 branch protection API](https://docs.github.com/en/rest/branches/branch-protection)。本轮没有运行 Node、构建、测试、生成器，也没有发布新应用版本。
