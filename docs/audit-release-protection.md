# 主分支 CI 发布保护核验

状态更新：2026-10-07。**上一轮前端 `04132258e24ef6f32dec5b6ddd191da02ed27637`（PR8）和后端 `45eb315377c393bc327021b2b9ccfae0fed4dfd9`（PR14）已完成发布验收，不再是待上线批次。** 两者源码均与各自合并代码树一致，精确源码与合并后main的完整CI已核验：

| 已验收版本 | 完整 CI 与生产证据 |
| --- | --- |
| 前端 `04132258` | [main CI 成功](https://github.com/willyuan24-source/baylink-web/actions/runs/37546196446)：3640项，3639通过、0失败、1既有TODO；生产113项HTTP与31项UI通过。[最终收据](C:/Users/willy/opus-qa/site-audit-1005/implementation/frontend-final-ci-verification.json)、[UI收据](C:/Users/willy/opus-qa/site-audit-1005/implementation/frontend-production-ui-verification.json)。 |
| 后端 `45eb315` | [main CI 成功](https://github.com/willyuan24-source/baylink-api/actions/runs/37541214293)：1284/1284；production health匹配，20项HTTP通过。[最终收据](C:/Users/willy/opus-qa/site-audit-1005/implementation/api-final-ci-verification.json)。 |

当前 `codex/audit-editorial-polish` 是后续新候选；它的精确提交CI、实际部署版本和生产HTTP/UI仍待验收，不以本地检查或上述旧收据替代。这里不填写尚未核验的新发布SHA。范围见 [audit-editorial-polish.md](audit-editorial-polish.md)及[audit-findings-tracker.md](audit-findings-tracker.md)。

以下保护配置GET快照取自2026-10-06 08:29 UTC；旧前端main、后端PR7、前端PR3及中间候选的结果均保留为历史记录，不代表它们仍是当前待验收批次。

使用现有 Git Credential Manager 身份 `willyuan24-source`，凭据仅在进程内存中用于 `api.github.com`，没有输出或写入文件。两个仓库均为 public，当前身份均有 admin 权限。

| 仓库 | 操作前 main 状态 | 操作后 GET 核验 |
| --- | --- | --- |
| `willyuan24-source/baylink-web` | `protected=false`；保护接口 404 `Branch not protected`；rulesets 与 main rules 为空 | HTTP 200；`protected=true`；`strict=true`；必须通过 `check`；限定 GitHub Actions `app_id=15368`；`enforce_admins=true` |
| `willyuan24-source/baylink-api` | `protected=false`；保护接口 404 `Branch not protected`；rulesets 与 main rules 为空 | HTTP 200；`protected=true`；`strict=true`；必须通过 `check`；限定 GitHub Actions `app_id=15368`；`enforce_admins=true` |

创建保护前再次读取了 main、现有保护、rulesets 与 main rules，确认没有已有规则需要转换。仅配置严格 CI 检查与管理员适用；没有增加人工审批要求或费用。`required_pull_request_reviews` 与 `restrictions` 继续为空，`allow_force_pushes=false`、`allow_deletions=false`。以后必须先把拟发布提交推至工作分支，通过对应提交的 CI 后再更新 main。

保护建立时的实际 workflow 和 check-run 均确认任务名为 `check`，发布者为 GitHub Actions。当时前端 `Website checks` 执行 `npm ci`、`npm run check`、高危依赖审计；后端 `API checks` 还执行 `npm test`。本轮候选调整检查编排后的边界见下文。

| 保护建立时前端 / 历史后端PR7提交 | 当时实际 CI 状态 |
| --- | --- |
| 前端 `9ccf6fe346316ff141ab9174a37c249b99bc14ef` | [`Website checks` 失败](https://github.com/willyuan24-source/baylink-web/actions/runs/37389181928) |
| 后端 `1905bd44d494fe54d9c18ed0209c4302bf97b89e` | 历史[`API checks` 成功](https://github.com/willyuan24-source/baylink-api/actions/runs/37462602251)；当时完整1130/1130及production health匹配，后续45eb315批次已另验收，仍不能代替当前editorial候选验收 |

GitHub deployment 元数据证实：前端旧提交 `9ccf6fe346316ff141ab9174a37c249b99bc14ef` 在 2026-10-05 23:38:26 UTC 已由 `vercel[bot]` 成功部署至 Production，deployment ID `6871891095`，对应 [Vercel 部署地址](https://baylink-8an9gslly-willyuans-projects.vercel.app)。这说明保护启用前，失败 CI 的提交曾被部署。新增保护阻止后续未满足检查的 main 更新；该元数据不能证明所有部署途径都受 CI 限制。

保护建立时，本地没有发现 Vercel/Render 环境凭据或 Vercel CLI 项目关联，后端没有 GitHub deployment 记录，因此没有据此断言Render或Vercel dashboard的全部发布策略。历史后端PR7已合并且当时production health核验1905bd44，这不证明Render手动入口都受CI约束。当时仅 `opus-bay` 分支的 Git 部署被禁用；这些是仓库配置，不代替平台设置核验。

历史前端PR3已合并为 `c401adf5cc3827ad106fc2d10d3d97511b039e1c`，合并代码树与通过PR CI的 `7a6ba791cd385dc92e29de700712843e605e09e4` 一致。其[合并后完整CI](https://github.com/willyuan24-source/baylink-web/actions/runs/37469324140)也已成功：3613项，3612通过、0失败、1历史TODO。这是此前批次证据，不能证明本轮源码已发布。Vercel预览部署随后返回失败，公开状态没有提供具体原因；不能由创建至失败的时间推断实际构建超时。

原托管命令重复执行整套串行回归，GitHub当时实测完整检查约31–35分钟。上一轮将 `vercel.json` 的 buildCommand 拆为 `npm run release:hosting`：保留lint、高危依赖审计、全部生成步骤、类型检查、构建、静态预渲染、全部分享卡二维码逐张独立解码、周报／日历及静态链接和资源门禁。`check` / `release:build` 仍执行完整测试，workflow和main的严格必需检查、管理员适用保护均保留。该拆分随后纳入04132258批次验收；本轮新增配置仍须先通过精确提交的完整CI再合并。预览成功不能代替生产验收，不手动提升未通过检查的预览部署。此前814张二维码及2518个HTML属于历史产物计数，已验收04132258为816张二维码及2524个HTML；新版本须按实际生成的全部产物验证，不能固定沿用旧数量。

上一轮新增两篇牙科／中文长者指南，实际目录由历史134篇扩充至136篇，独立来源由1259扩充至1273，编辑内容ID由827扩充至829；保留原来源ID与历史记录。来源注册不代表网页均已直接读取或事实均已人工复核，DHCS牙医目录直接读取失败已在文章公开注明。该轮搜索portal焦点和冷lazy过渡修复、登录／MFA重要文字阅读token及48px动作纳入本地28/28无障碍回归；320px／125%登录labels与privacy当时实测17.5px、滚动宽与文档宽均305px，无横溢。冷reload初次及缓存搜索Esc均恢复真实按钮。当时后端完整本地回归1148/1148通过。这些中间证据予以保留；该批次后来完成的精确CI、构建和正式域名HTTP/UI验收见文首04132258／45eb315收据，不能继续称旧批次待验收。

## 当前 editorial 候选的发布边界

站点测试、3D测试、完整构建与产物检查在新workflow中并行，原名 `check` 作为必需汇总要求三者全部成功；递归发现的测试全集仍全部纳入，不按修改路径跳过。`release:hosting` 增加六个已审阅样式范围的token门禁，仍保留所有原生成和产物检查；本地 `release:build` 仍执行完整测试。这是候选代码的检查契约，不等于新提交的GitHub Actions已通过，也不证明Vercel／Render全部控制台入口受该契约限制。

本轮还涉及首页与指南图片层次、详情主动作、AI／小队阅读缩放、移动底栏、繁体帖子原文切换、月刊按展示范围读取意向、内容覆盖报表、具体文章／优惠复核，以及后端回答与联系额度改进。精确范围见本轮说明；不能由这些局部改动宣称全站视觉或三语已全部统一。共享已验证手机号的额度与账号额度共同限制联系请求，允许家庭共用号码，不建立唯一自然人身份。生产延迟分布、真实供应商送达、管理员MFA启用、平台控制台保护与API美元预算仍须各自实证；本地320px／125%界面观察不能作为新的生产验收收据。

保护在合并前检验已通过检查的代码；合并后的main CI和正式HTTP/UI验收另行核对。没有据此声称已配置Vercel Deployment Checks、手动发布入口保护或CI预构建部署。

接口依据：[GitHub 官方 branch protection API](https://docs.github.com/en/rest/branches/branch-protection)。保护配置子任务当时未运行构建或发布；后端PR7完整测试、CI与上线，以及后续04132258／45eb315完成验收，均有各自历史证据。当前editorial候选的精确提交、CI及生产HTTP/UI证据由主代理另行记录在implementation目录，不以任何旧批次记录替代。
