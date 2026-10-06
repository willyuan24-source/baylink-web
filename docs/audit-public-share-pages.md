# 月刊、手机日历与公开分享页补齐

2026-10-06，本轮直接实现审计中可验证的使用体验遗漏。没有清除收藏、阅读器保存记录、账号帖子或 3D 功能，也没有更改现有 3D 回滚窗口。

- 月刊生活快讯移动到活动列表之后，原官方来源、核对日期与分区锚点保留。
- `/this-week` 服务端与客户端初始筛选为湾区当地本周末；简体、繁体、英文前缀及尾斜线一致。显式 URL 筛选优先，选择「全部日期」保留 `when=all`，不会重新变回周末。
- 手机日历的 DOM 阅读顺序、视觉顺序均先显示当天活动。地图默认不挂载，用户展开或点击活动定位后才加载；桌面保持左日历、右列表与地图，响应窗口宽度变化。

## 公开分享服务器页面

`api/outing-page.ts`、`api/user-card-page.ts` 使用 `server/public-share-page.ts`。服务器匿名读取现有 API；不转发访客 Cookie 或 Authorization，也不把上游对象整体序列化到 HTML。

小队只使用 `GET /api/outings/:id` 的 guest DTO，逐字段取标题、说明、真实日期与时间、城市、地点、费用说明、队长公开昵称、容量、已确认人数和官方来源。日期、Pacific 时区与毫秒时间互相核对，不一致时返回 503。人数缺失时不编造统计。成员、申请、申请留言、候补、投票、私信、用户当前参与状态、电话和 token 不进入页面。

名片只使用 `GET /api/users/:id/public`；禁止以通用账号 API 替代。展示公开昵称、简介、状态、地点、标签、兴趣、安全头像/封面、真实帖子计数及最多三条公开帖子标题。继续尊重地点与兴趣的显式隐藏标记。电话、邮箱、联系方式、私信、审核证件、屏蔽关系不进入页面。后端必须同时保证暂停账号、删除中账号与不公开的帖子被此公开接口拒绝；SSR 不能恢复公开 DTO 中已被删去的账号状态。

用户文字和属性进行 HTML 转义，JSON-LD 转义 `<`，图片只允许安全 HTTPS 或同站路径。请求语言独立决定文案、语言标签与元数据。页面使用 `no-store`、`noindex, follow`，避免第三方缓存长期暴露已变更的公开资料。缺失或隐藏记录为 404；接口故障、格式冲突和不完整构建为可重试 503。GET/HEAD 可用，其他方法为 405。

## 由主任务集成的路由

- 现有小队分享 URL 是 `/together?outing=<合法 id>`，以及 `/en/together`、`/zh-Hant/together` 同类 query。仅带合法 `outing` 的请求重写至 `/api/outing-page?outingId=<id>&siteLanguage=<语言>`，普通 `/together` 仍使用原页面。
- `/users/<合法 id>` 及语言前缀重写至 `/api/user-card-page?userId=<id>&siteLanguage=<语言>`。现有 `?lang=` 链接仍兼容。
- 两个函数需像现有 `post-page` 一样包含构建后的 `dist/index.html`。本子任务不改中央路由生成脚本与 `vercel.json`。
- 小队 canonical/OG URL 只保留经过验证的 `outing` id，不保留追踪或其他请求参数。个人名片 canonical 不含 query。
- 本地 localStorage 计划没有公开服务器存储。本轮不会伪造可供服务器读取的公开计划或其 OG。

## 验证边界

客户端小队详情复用已有成功读取的 DTO，逐字段投影公开安排的标题、说明、地点、费用和日期到分享元数据；不会额外请求公开接口。选定小队时列表页不覆盖服务器分享卡；切换语言只更新本地显示与对应 canonical，标题及 JSON-LD 中的用户文字保持原文。仅经过验证的 `outing` id 留在 canonical/OG URL，追踪参数不进入。返回列表清理旧 Event；刷新后接口确认记录不可访问时撤下旧详情与成功分享信息。始终保留 `noindex, follow`。

新增 `tests/audit-calendar-monthly.test.tsx` 的五条实际 UI/SSR 行为测试、`tests/public-share-pages.test.ts` 的五条匿名读取/隐私/XSS/语言隔离/错误响应测试，以及 `tests/outing-metadata-ui.test.tsx` 的四条客户端选定小队/语言切换/撤下详情/公开字段与日期测试。没有放宽原测试约束。遵主任务要求，本子任务没有运行 Node、测试或构建；由主任务串行执行最终检查、路由集成、部署及上线后的 URL/元数据核验。
