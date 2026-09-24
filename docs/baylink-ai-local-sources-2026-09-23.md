# BAYLINK AI 活动核查与集成记录

核查日：2026-09-23（America/Los_Angeles）。本批新增 8 场活动、一篇实用指南和 /ai-in-the-bay 专题页。活动周是分别报名的系列场次，不是连续开放的场馆，也不是一张通票。

## 活动周边界

- [AI Week SF](https://aiweeksf.com/)：2026-09-27–10-03；[官方日历](https://aiweeksf.com/calendar)。
- [a16z Tech Week](https://www.tech-week.com/)：San Francisco 为 2026-10-05–11；Los Angeles 为 10-12–18，不混入湾区。[SF 官方日历](https://www.tech-week.com/calendar/sf)。
- Oakland 的 10/02 civic sprint 属于 Oakland Tech Week 场次。页面按日期分组，不把所有场次宣称为 AI Week SF 官方合作活动。
- AI Week 首页公开的 /api/events 仅用于发现线索。逐项事实以更接近活动的官方主办方页为准；没有把聚合器内部 AI 审核字段当事实。

## 新增 8 场

| 数据 ID | 日期和时间（PDT） | 场馆 | 费用 / 报名 | 主来源 |
| --- | --- | --- | --- | --- |
| ai-conference-sf-2026 | 9/29 Day ZERØ；9/30、10/1 正式大会，各自日程 | Pier 48 Shed A & B, San Francisco | 付费，票种包括的日期和项目不同；不设一个臆测总价 | [大会官网](https://aiconference.com/) |
| pyladies-snowflake-ai-data-2026 | 9/30 18:00–20:30 | Snowflake Silicon Valley AI Hub, 135 Constitution Dr, 8F, Menlo Park | 免费，预先登记、行为准则 | [PyLadies 主办方](https://luma.com/693643qu) |
| runtime-modal-sf-2026 | 10/1 08:30–18:30 | The Midway, 900 Marin St, San Francisco | 免费申请，需批准 | [Modal 主办方](https://luma.com/runtime-by-modal) |
| llmday-san-francisco-q4-2026 | 10/1 09:00–17:30（公开议程）；Luma 标至 18:00 | Harness SF HQ, 55 Stockton St, San Francisco | 学生/求职者 $49；自费 $99；公司报销 $299；资格以票种为准 | [主办方议程](https://llmday.com/2026-san-francisco-q4/) · [报名](https://luma.com/llmday-2026-san-francisco-q4) |
| oakland-civic-ai-design-sprint-2026 | 10/2 13:00–17:00 | Community Hub, 1955 Broadway, Oakland | 免费登记；跨学科设计冲刺 | [/dev/color 与 DreamMachineAcademy](https://luma.com/cgx812ka) |
| surrealdb-mastra-shared-memory-2026 | 10/5 17:00–20:30 | AWS Builder Loft, 525 Market St, San Francisco | 免费申请，18+ 且需批准；政府签发实体附照片证件 | [SurrealDB / Mastra](https://luma.com/surrealdb-gs07) · [SurrealDB 活动目录](https://surrealdb.com/events) |
| n8n-sf-tech-week-workshop-2026 | 10/5 18:00–21:00 | Digital Jungle SF, 972 Mission St | 免费登记；带电脑和 n8n 账户，可用试用；外部模型服务另计 | [n8n 社区主办方](https://luma.com/n8n-ntlt) |
| oss4ai-agent-day-menlo-park-2026 | 10/9 12:00–18:00 | Silicon Valley AI Hub, 135 Constitution Dr, Menlo Park | 免费申请，需批准；参加和申请演讲/展示是两件事 | [Open Source for AI](https://luma.com/7wn8tsf7) |

未展示实时余票、名额、审核通过率或活动保证。LLMday 已过期的 9/1 early bird 没有当现价；其免费 Community Hero 票带条件及审批，没有把全活动标为免费。编辑建议在 plan 中与主办方事实明确区分。

## 已发现并处理的冲突

- LLMday：AI Week 聚合数据旧地址为 Redwood City 的 2317 Broadway；旧报名地址重定向到 SF 新页。当前主办方网站与 Luma 都指向 55 Stockton，采用后者，并在指南提醒出发前检查确认信。
- ChipAgents（https://luma.com/wr1pn7zd）：聚合列表提供 10/2 和公开 HQ，现页存在跨到 11/20 的日期与隐匿会场状态。排除，没有发表旧地址。
- AI Native Summit（https://luma.com/3t95uj7s）：正文、票种和结构数据的日期/售票计划不一致，排除。
- AI Reality Summit 和 Flower AI Day 的聚合记录有同源重复 / 时间冲突，未把重复记录算作不同活动。
- Partiful 上几场 Tech Week 活动的公开页面未提供可确认地址，未为了凑数量猜地址。
- 搜索摘要或日历中的时间只用于查找，不覆盖当前主办方原页。

## 坐标

aiEventLocations 所有点均来自公开 Luma 页面结构化场馆 coordinate；仅采用公开会场。未绕过报名墙或使用隐藏场馆数据。

The AI Conference 的官网明确 Pier 48，坐标来自同一会场的官方周边活动 [Ignite](https://luma.com/tzsufkl6)。其余 7 场均由自己的公开报名页提供。精度 venue 表示已公开会场的地图锚点，不代表入口、无障碍路线或停车场。

## 集成接口

- src/data/ai-local-events.ts：aiLocalEvents（8）、aiEventLocations（8）、aiEventSettings（4 个明确室内场次：PyLadies 八楼、LLMday HQ、AWS Builder Loft 建筑内、Agent Day 的 presentation/workshop rooms；未确认的活动不填 setting）
- src/data/guides-ai-week.ts：aiWeekGuides（1）、aiWeekGuideSlug
- src/pages/AiLocalPage.tsx：default export，路径 /ai-in-the-bay；自行 import 独立 CSS
- src/data/ai-local-en.json：数据与专题页的中文原文 → 英文
- src/data/place-locations.json：18 个现有景点的独立坐标来源；说明见景点坐标文档

由 root 接入 monthly-edition、guides、locale、routing、prerender 和 exports，避免共享文件冲突。活动 imageKey 留给集成方选择现有通用插图并保留插图标注。新指南需要独立 cover：建议 ai-in-the-bay-2026；或者确认未占用的现有主题图，并明确它不是会场照片。专题页本身没有新增外部图片。

## 校验

- TypeScript app noEmit：通过
- ESLint：3 个新增 TS/TSX 文件通过
- 使用 TypeScript AST 遍历数据和页面中文字符串，与英文 JSON 比对：159 个翻译键，遗漏 0
- 无安装额外依赖、无私人报名、无 commit / push
