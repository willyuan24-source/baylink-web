# BAYLINK 内容扩充 · 2026-09-08

本轮面向湾区华人居民、新来者和需要本地服务的人，补齐原有指南中较薄弱的实际任务。公开生活指南由 20 篇增加至 28 篇。

## 新增内容

| 主题 | 读者可以完成的下一步 | 路径 |
| --- | --- | --- |
| 机场落地 | 分清 SFO、SJC、OAK，准备接送信息与备用交通 | `/guides/bay-area-airport-arrival-guide` |
| 兼职防骗 | 核对招聘主体与报酬，识别付费、任务充值及假支票 | `/guides/bay-area-part-time-job-safety-guide` |
| 清洁询价 | 列工作范围、比较报价并按约定验收 | `/guides/bay-area-cleaning-quote-checklist` |
| 家庭报修 | 先确认安全，再准备现象、型号、报价与留档 | `/guides/bay-area-repair-request-guide` |
| 翻译服务 | 明确用途、接收机构要求、交付与隐私处理 | `/guides/bay-area-translation-service-guide` |
| 图书馆 | 按具体馆核对办卡、数字资源与活动入口 | `/guides/bay-area-library-starter-guide` |
| 东湾周末 | 选择 Lake Merritt 或 Berkeley 的一条慢路线 | `/guides/east-bay-first-weekend-guide` |
| 无车北湾 | 安排 Sausalito 渡轮往返与码头附近散步 | `/guides/north-bay-car-free-day-guide` |

新增文章共附 28 条官方来源链接；同一机构的不同办事入口分别列出。服务与本地生活组核验细节见同目录 `content-sources-services-2026-09-08.md` 与 `content-sources-local-life-2026-09-08.md`。

机场资料核验自 [SFO 地面交通](https://www.flysfo.com/passengers/ground-transportation)、[SJC 公共交通](https://www.flysanjose.com/public-transit)、[BART OAK 连接](https://www.bart.gov/guide/airport/oak) 和 [VTA 60 路](https://www.vta.org/go/routes/60)。不固化票价、首末班、临时上客区或行程耗时。

兼职资料核验自 FTC 的[工作骗局](https://consumer.ftc.gov/articles/job-scams)、[任务骗局](https://consumer.ftc.gov/consumer-alerts/2024/11/task-scams-create-illusion-making-money)、[假支票](https://consumer.ftc.gov/articles/how-spot-avoid-and-report-fake-check-scams)与[受骗后处理](https://consumer.ftc.gov/articles/what-do-if-you-were-scammed)。独立编辑复核后补齐个人信息泄露的处理入口；不承诺追回款项或判断个人工作许可。

## 内容入口与可用性

- 首页、指南页和编辑推荐页新增三个专题：安顿新生活、找人帮忙、周末走近湾区。
- 清洁、维修、翻译、接送和兼职分类优先展示对应新指南；静态分类页也提供相关正文链接。
- 新增 6 份可复制模板，均清楚标为示例并要求替换占位符；复制失败时保留文字与手动复制提示。
- 指南索引维持分类顺序，同优先级文章优先显示新内容；增加直接跳至搜索区的入口。
- 编辑专题使用轻量链接文案，避免首页为展示几个入口而加载整本指南正文。
- 更新公开路由白名单、站点地图及静态预渲染。旧文章的更新时间没有因新增内容而刷新。

## 编辑边界

本轮没有创建虚构房源、招聘、商家、活动或用户评论，没有替原帖作者确认价格、空置、经营资质或需求有效性。路线是依据官方资料整理的编辑建议，不是实地走测报告。具体业务时刻、办卡资格和机构接收要求由读者通过文中官方入口复核。

## 验收

`npm run check` 已通过：55 项测试全部通过，ESLint 0 错误（44 项现有警告），TypeScript 与生产构建通过，预渲染 45 个公开 HTML 页面。检查覆盖全部指南 SSR、路由与站点地图；新增模板复制成功/拒绝测试，以及专题链接完整性测试。浏览器验证指南搜索、文章读取、模板复制与专题跳转。

生产入口主脚本为 174.00 kB（gzip 54.37 kB）；28 篇指南正文保留在单独的延迟加载文件中，未随首页专题一次性加载。

本地预览仅使用隔离的内存测试数据；没有向真实用户发送消息或发布交易内容。
