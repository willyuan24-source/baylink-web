# BAYLINK 第一、二批功能交付

## 页面与用户流程

- `/plan`：BayBay 从已发布活动目录选择最多三个方案。用户可指定日期、地区、每人门票预算、孩子年龄、室内外与交通偏好；自然语言可补充具体目的城市。无完整匹配时不强凑结果。使用 AI 时只允许选择真实目录 ID，日期、票价、场地与年龄约束仍由服务端验证。
- `/plan` 的地图：MapLibre GL JS 6.11.1 + OpenFreeMap，点击后加载。18 个景点及 10 个活动有带来源的参考坐标；无坐标项目仍可阅读和选入清单。附近建议显示直线距离，不估算驾驶时间。每份前端计划最多三站，可调整顺序、保存、分享。
- `/my-week`：未来七天的活动、地区/兴趣/交通偏好、已保存计划与收藏。账号记录存 MongoDB；访客记录只在本机。访客导入必须主动点击，阅读历史不上传。账号切换使待处理请求失效，计划版本冲突保留草稿并提示刷新。
- `/ai-in-the-bay`：8 场官方核查的湾区 AI 活动及一篇新手攻略，覆盖 AI Week SF / SF Tech Week。已同步中文、英文与现有繁体切换；没有将活动周本身当作全天可入场活动。
- 首页、BayBay 对话、景点探索、活动详情与个人空间都已连接新流程。攻略与活动详情可收藏到“我的这周”。

## 内容与来源

本次目录为 73 场活动、73 篇攻略、18 个规划景点。新增 AI 活动资料见 `baylink-ai-local-sources-2026-09-23.md`，坐标见 `baylink-place-locations-2026-09-23.md`。活动照片位置沿用明确标注的通用原创插图，不冒充活动实景。

规划增强字段只保存有出处的场地、年龄和价格。免费描述仅指官方所述入场，不包含交通、餐饮或停车；未知票价不当作零。儿童请求不能混入没有亲子或适龄依据的专业技术活动。多日项目须另外核对当日场次。

## 来源监测

后端固定登记 48 个官方来源，Mongo 持久化基线、差异证据、抓取时间和管理员复核记录。服务启动后检查，之后每轮结束六小时再检查；跨实例租约防重复工作。管理员从“我的空间 → 来源变更监测”查看前后文本、运行检查、标记复核。

生产首轮结果：36 个来源建立基线，12 个来源因访问限制或需要 JavaScript 等进入人工核查。抓取时间不修改编辑 `verifiedAt`；错误不被解释为活动取消；监测也不自动改写活动原文。Render 进程休眠/离线期间不会运行计时器，恢复后检查到期来源。完整运维说明在后端 `docs/source-monitor.md`。

## 匿名功能统计

已接入六项操作的第一方聚合计数：推荐请求成功、计划保存、公开分享链接操作、收藏、地图打开和官方链接点击。只保存湾区日期、事件类型、界面语言和次数；没有账号、会话、内容 ID、提问正文或页面地址。前端不携带鉴权或 referrer，尊重 Do Not Track / Global Privacy Control；Mongo 日级记录保留 180 天。

管理员的来源监测工作台显示最近 30 天的六项计数。数据失败显示重试，不冒充零。计数包含重复操作，不能据此宣称独立用户数、转化率或次周留存率；这些指标仍需要后续自愿参与的评估。完整接口、限制与存储说明见后端 `docs/product-metrics.md`。没有接入第三方录像或跟踪 SDK。

## 导出、依赖与部署

前端构建导出 `public/planner-catalog.json`。发布内容时另运行：

```powershell
npx tsx --tsconfig tsconfig.app.json scripts/export-planner-catalog.ts ../baylink-backend/data/planner-catalog.json
npx tsx --tsconfig tsconfig.app.json scripts/export-event-catalog.ts ../baylink-backend/data/event-catalog.json
npx tsx --tsconfig tsconfig.app.json scripts/export-guide-catalog.ts ../baylink-backend/data/guide-catalog.json
```

先发布 API，再发布前端。AI 沿用现有模型配置，支持 `OPENAI_PLANNER_MODEL` 覆盖；没有强制绑定新模型或增加付费平台。地图 Worker 通过 Vite `?worker&url` 独立打包，CSP 只新增 `https://tiles.openfreemap.org`。

参考：[MapLibre 官方 Vite 集成](https://maplibre.org/maplibre-gl-js/docs/)、[OpenFreeMap](https://openfreemap.org/quick_start/)。

## 验证

- 前端完整测试 430 项通过，包含真实页面交互、账户切换、匿名统计请求隐私和管理员计数失败恢复。
- 后端完整测试 141 项通过，含真实目录、账号隔离、并发写入、版本冲突、AI 无法伪造 ID/绕过城市与年龄约束、来源监测安全与状态转换、匿名计数隐私与管理员权限。
- TypeScript / ESLint 无错误；构建输出 230 个公开 HTML 页面、229 个 sitemap 项和 207 张分享卡。My Week 排除于 sitemap，响应 `noindex` / `no-store`。
- 浏览器验收：地图底图与署名、公开分享恢复、访客保存、My Week 读回、中英文、手机断点。账号同步使用真实路由与持久化模型的隔离测试验证，未创建生产测试账号。
- 正式站复核：中文自然语言中的 Fremont、10 月 2 日、五岁孩子与门票预算共同生效，只返回真实匹配场次；互动地图的生产 CSP、底图、标记与署名正常。`/my-week` 响应 `noindex, follow` 和 `no-store`。
