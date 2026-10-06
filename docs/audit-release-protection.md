# 主分支 CI 发布保护核验

保护配置GET快照：2026-10-06 08:29 UTC。下列旧前端main状态是保护启用时的历史记录；后端后续发布状态已经更新，最终前端发布须另核对目标CI和实际线上版本。

使用现有 Git Credential Manager 身份 `willyuan24-source`，凭据仅在进程内存中用于 `api.github.com`，没有输出或写入文件。两个仓库均为 public，当前身份均有 admin 权限。

| 仓库 | 操作前 main 状态 | 操作后 GET 核验 |
| --- | --- | --- |
| `willyuan24-source/baylink-web` | `protected=false`；保护接口 404 `Branch not protected`；rulesets 与 main rules 为空 | HTTP 200；`protected=true`；`strict=true`；必须通过 `check`；限定 GitHub Actions `app_id=15368`；`enforce_admins=true` |
| `willyuan24-source/baylink-api` | `protected=false`；保护接口 404 `Branch not protected`；rulesets 与 main rules 为空 | HTTP 200；`protected=true`；`strict=true`；必须通过 `check`；限定 GitHub Actions `app_id=15368`；`enforce_admins=true` |

创建保护前再次读取了 main、现有保护、rulesets 与 main rules，确认没有已有规则需要转换。仅配置严格 CI 检查与管理员适用；没有增加人工审批要求或费用。`required_pull_request_reviews` 与 `restrictions` 继续为空，`allow_force_pushes=false`、`allow_deletions=false`。以后必须先把拟发布提交推至工作分支，通过对应提交的 CI 后再更新 main。

实际 workflow 和 check-run 均确认任务名为 `check`，发布者为 GitHub Actions。前端 `Website checks` 执行 `npm ci`、`npm run check`、高危依赖审计；后端 `API checks` 还执行 `npm test`。

| 保护建立时前端 / 当前后端提交 | 实际 CI 状态 |
| --- | --- |
| 前端 `9ccf6fe346316ff141ab9174a37c249b99bc14ef` | [`Website checks` 失败](https://github.com/willyuan24-source/baylink-web/actions/runs/37389181928) |
| 后端 `1905bd44d494fe54d9c18ed0209c4302bf97b89e` | [`API checks` 成功](https://github.com/willyuan24-source/baylink-api/actions/runs/37462602251)；完整1130/1130，production health匹配 |

GitHub deployment 元数据证实：前端旧提交 `9ccf6fe346316ff141ab9174a37c249b99bc14ef` 在 2026-10-05 23:38:26 UTC 已由 `vercel[bot]` 成功部署至 Production，deployment ID `6871891095`，对应 [Vercel 部署地址](https://baylink-8an9gslly-willyuans-projects.vercel.app)。这说明保护启用前，失败 CI 的提交曾被部署。新增保护阻止后续未满足检查的 main 更新；该元数据不能证明所有部署途径都受 CI 限制。

本地没有发现 Vercel/Render 环境凭据或 Vercel CLI 项目关联，后端没有 GitHub deployment 记录，因此没有据此断言Render或Vercel dashboard的全部发布策略。后端PR7已合并且production health核验1905bd44，这不证明Render手动入口都受CI约束。仅 `opus-bay` 分支的 Git 部署被禁用；这些是仓库配置，不代替平台设置核验。

前端PR3已合并为 `c401adf5cc3827ad106fc2d10d3d97511b039e1c`，合并代码树与通过PR CI的 `7a6ba791cd385dc92e29de700712843e605e09e4` 一致。其[合并后完整CI](https://github.com/willyuan24-source/baylink-web/actions/runs/37469324140)也已成功：3613项，3612通过、0失败、1历史TODO。Vercel预览部署随后返回失败，公开状态没有提供具体原因；不能由创建至失败的时间推断实际构建超时。

原托管命令重复执行整套串行回归，GitHub实测完整检查约31–35分钟。现将 `vercel.json` 的 buildCommand 拆为 `npm run release:hosting`：保留lint、高危依赖审计、全部生成步骤、类型检查、构建、静态预渲染、814张二维码独立解码、周报/日历及静态链接和资源门禁。`check` / `release:build` 仍执行完整测试，workflow和main的严格必需检查、管理员适用保护均保留。该配置修改也必须先通过精确提交的完整CI再合并；预览成功不能代替生产验收，不手动提升未通过检查的预览部署。

保护在合并前检验已通过检查的代码；合并后的main CI和正式HTTP/UI验收另行核对。没有据此声称已配置Vercel Deployment Checks、手动发布入口保护或CI预构建部署。

接口依据：[GitHub 官方 branch protection API](https://docs.github.com/en/rest/branches/branch-protection)。保护配置子任务当时未运行构建或发布；后续后端PR7已通过完整测试、CI并上线。前端PR3的精确提交、CI、生产HTTP/UI证据由主代理另行记录在implementation目录。
