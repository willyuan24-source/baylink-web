# BAYLINK website

BAYLINK 湾区华人本地信息网站，React 18 + TypeScript + Vite。前端由 Vercel 托管，API/Socket 服务位于同级 `baylink-backend` 仓库并由 Render 托管。

## 本地开发

使用 Node.js 24（最低 22.14），执行 `npm ci`，按需要复制 `.env.example` 为 `.env.local`，然后执行 `npm run dev`。开发默认 HTTP 和 Socket 都连接 `http://localhost:3000`。所有 `VITE_` 变量会进入浏览器公开构建，不能存放秘密。

只测试界面时，可在另一个终端执行 `node scripts/demo-api.mjs`。该服务仅监听本机、使用内存数据，不连接 MongoDB、不发送短信或邮件。浏览器访问 `http://localhost:5173`，用 `demo@example.test` 和任意非空密码登录测试账号。演示 API 不用于安全测试或部署。

真实本地后端的环境变量和隔离测试说明见后端 README。不要用生产数据库做写入测试。

## 检查

- `npm run lint`：检查语法与 Hooks；历史 API 的显式 any 和混合组件导出仍以 warning 呈现，不能把通过 lint 理解成全代码严格类型化。
- `npm test`：测试消息对账、自己的发布分页、联系方式检测、会话解析、有效状态、弹窗焦点与滚动恢复、页面元数据和帖子 HTML 隐私边界。
- `npm run build`：TypeScript 检查、Vite 构建、公开页面预渲染；不会抓取已登录用户或线上帖子数据。
- `npm run check`：顺序运行以上检查。
- `npm audit --audit-level=high`：检查依赖公告。CI 使用 Node 24 运行相同校验。

## 页面与部署

`vercel.json` 维护页面路由和安全响应头。`scripts/prerender.tsx` 从指南源数据生成 47 个 HTML 页面及 sitemap。指南正文与法律页面初始 HTML 可直接读取；首页和分类的最新帖子在浏览器加载。

## 搜索、收藏、草稿与 BayBay

- 首页筛选保存在 URL 的 `q`、`region`、`type` 参数，分类保留原有 `/category/:slug` 路由。指南使用 `q`、`category` 参数，检索正文、清单及模板；文章的返回入口保留搜索条件。
- 收藏仅保存公开摘要到当前账号或访客在此浏览器的存储，打开收藏时重新读取可访问的帖子；不会同步到其他设备，且不保存联系方式或用户对象。“有用”仍是原有点赞功能。
- 新帖文字、设置和 AI 原始需求可保存为账号隔离的本机草稿；照片不保存。再次打开时可恢复或丢弃，成功发布才清除；编辑已有帖子不使用新帖草稿。
- 匿名私信入口在登录后继续打开目标聊天并保留关联帖子，不自动发送消息或联系方式请求。
- BayBay 可以展示真实匹配帖子和明确降级状态。规则检索只按已识别条件查找，价格不明确时不会声称符合预算；模型答案使用已发布指南和来源，不代表实时访问官方站点。
- 构建会执行 `npm run export:guides`，从同一指南源数据生成 `public/baybay-guides.json`。指南更新需同时运行 `npm run export:guides -- ../baylink-backend/data/guide-catalog.json` 并发布两个仓库，确保后端知识目录同步。

`api/post-page.ts` 在 Vercel 使用匿名公开 API 为 `/posts/:id` 生成 HTML 与分享元数据：不转发 Cookie/Authorization，不序列化联系方式、用户对象或鉴权字段，响应禁止缓存。缺失/删除返回 404；服务故障返回 503，避免误报告内容删除。隐私相关页面使用 noindex，未知路由返回真正的 404。

部署变量：

| 变量 | 用途 | 生产默认 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 浏览器 HTTP API | `https://baylink-api.onrender.com/api` |
| `VITE_SOCKET_URL` | 浏览器 Socket | 从 HTTP API 的 origin 推导 |
| `BAYLINK_PUBLIC_API_URL` | Vercel 帖子 HTML 的公开 API | 同上 |

如果部署预览连接另一个 API，需同时在 Vercel CSP 的 connect-src 和后端 CORS 加入明确的预览来源。不要使用通配符放开鉴权接口；不要将本地 `.env.local` 打包部署。Vercel 的实际域名、函数文件打包和响应头需在预览环境再次验收。

先部署兼容的新后端，再部署前端。新的“我的发布”支持作者分页、已结束帖子和状态管理；旧后端会触发公开列表兼容回退，不能完整读取已结束/隐藏记录。退出撤销、联系方式校验和有效确认权限依赖新后端。

## 内容维护

指南在 `src/data/guides.ts`，分类对应在 `src/routing.ts` 与 `src/lib/constants.ts`；增加分类需同步后端过滤与 Vercel 路由。参考链接支持读者核对，不代表每次部署都重新核验正文；不要自动更新文章复核日期。

旧帖子没有确认时间时显示“待确认有效”；超过 30 天显示“需要再次确认”。作者主动确认后才更新确认日期。已结束帖子从公开列表移除，但作者仍可管理。手机验证、资料审核、编辑推荐的含义分别说明，均不构成交易担保。

审计原始结果和实施记录位于 `docs/`。线上房源是否有效、商家承诺、法律主体、删除保留流程、短信 STOP/HELP 和备份恢复需要实际运营确认，不能由代码或测试数据推定。
