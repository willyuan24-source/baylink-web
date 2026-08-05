# BAYLINK 现代化改造路线图（2026-08）

> 本文是对 baylink.us（web 端）的全面现代化分析总结：更现代好看、更交互式、更深度的 AI 集成，对标 Airbnb / Linear / 小红书 / 闲鱼 / Meta AI / ChatGPT 级别的产品设计。
> 逐条证据（含文件行号）见同目录 `modernization-audit-details-2026-08.md`。

## 总体判断

BAYLINK 的底子比想象中好：奶油绿品牌辨识度强、已有真实的设计 token 层、URL 深链、乐观点赞、BayBay 结构化草稿——这些是大多数同类项目没有的。差距不在"重写"，而在三件事：

1. **一批"坏了但没人发现"的问题**（动画插件没装、safe-area 失效、HEIC 照片裂图、canned AI 回复）
2. **体验层没做完**（无骨架屏、无焦点陷阱、无暗色模式、旧皮肤残留）
3. **AI 只是个入口，没长在任务流里**（发帖/聊天/搜索三大高杠杆场景零 AI）

## 一、立即修复（每项 < 1 天，收益巨大）

| 问题 | 证据 | 修法 |
|---|---|---|
| 所有入场动画是死代码 | `animate-in` 等类用了 15+ 处，但 `tailwindcss-animate` 从未安装（tailwind.config.js `plugins: []`） | `npm i -D tailwindcss-animate` + 注册插件 |
| iPhone 照片在 Chrome/Android 全裂 | imageCompression.ts:132-135 HEIC 直接跳过压缩原样上传成 `data:image/heic` | canvas 强制转码 JPEG（管线已存在） |
| safe-area CSS 全部失效 | index.html viewport 缺 `viewport-fit=cover`，`env(safe-area-inset-*)` 恒为 0 | 加 viewport-fit=cover |
| iOS 聚焦输入框页面放大 | 聊天输入 15px、搜索 14px（<16px 触发 Safari 缩放） | 输入统一 16px |
| 首页图片 ~8MB | hero 1.8MB PNG、横版 logo 1.16MB、BayBay 头像 1MB；18 张图 0 懒加载；vercel.json 无缓存头 | WebP 重导出（logo 转 SVG）、`loading="lazy"`、immutable 缓存头 |
| 筛选后"加载更多"看似坏了 | 服务端每页 5 条，region/category 在客户端过滤（App.tsx:4545-4547），一页可能剩 0 条 | 过滤参数传给 API，服务端过滤 |
| BayBay 演示问题全是罐头回复 | 自家推荐的 4 个问题全部返回同一句 fallback + 固定三篇指南 | 见 AI 部分 |
| 死代码地雷 | src/pages/Chat、src/pages/Profile 未被引用（含繁体字串）；components/PostCard、Avatar、Toast 是旧版重复；PublicProfileModal 永不可达（viewingUserId 永远 null） | 删除 pages/*；components 三件用 App.tsx 内联版覆盖后引入 |
| build 不做类型检查 | package.json build 只有 `vite build`，strict tsconfig 形同虚设 | `"build": "tsc -b && vite build"` |
| Toast 对屏幕阅读器静默 | 无 aria-live；全 app 仅 21 个 aria-label | Toast 加 `role="status" aria-live="polite"` |
| 无 robots.txt / sitemap | public/ 里没有 | 补上 |

## 二、更现代好看（设计系统）

1. **统一到一套 token，CSS 变量作源头**：现状是 baylink.* token 与 ~330 处默认 Tailwind 灰/琥珀/蓝混用、32 处任意 hex、`#FFF8F0` 旧皮肤残留在 4 个在用视图（InfoPage / MyPostsView / EditProfile / ProfileView）。改为 `--bg/--surface/--ink/--accent...` → tailwind 读变量，这也是暗色模式的前提。
2. **暗色模式**：`darkMode:'class'` 配置了但 0 实现。做暖色系深色主题（#14171A 底 + 去饱和绿 #34C284），跟随 prefers-color-scheme + 手动开关。
3. **对比度**：`text-baylink-muted`(#9A978F) 用了 203 次，对比度仅 2.9:1，且多为 10-11px；新增 muted-strong ≈ #6F6C63，小号绿字改用 #128256，设 11px 字号下限。
4. **字号体系**：437 处任意 `text-[Npx]` 收敛为 6-7 档命名字阶；圆角收敛为 12/16/24/28 四档；z-index 12 个任意值改命名刻度。
5. **动效**：装回 tailwindcss-animate 后，统一 150-250ms ease-out；详情页/点赞引入 Motion（框架级弹簧）；导航用 View Transitions API（2025/10 已 Baseline，渐进增强 ~10 行）。
6. **Feed 布局**：图片类目（二手/闲置）改小红书式双列瀑布流（图上价签），文字类目（需求/招聘）保留单列。
7. **图标语言**：emoji 分类图标换成品牌色 lucide/定制插画；CSS 画的假封面换成真插画资产。
8. **分享卡**：og:image 目前是方形 app 图标 → 做 1200x630 分享卡 + per-post OG（edge function 注入），另做微信分享海报（canvas 卡片 + 二维码）。

## 三、更交互式

1. **一个 Modal/Sheet 原语**（portal + 焦点陷阱 + Esc + 滚动锁 + aria-modal + 动画），迁移全部 ~12 个弹层；native `confirm()/alert()` 全部换品牌化 ConfirmDialog。
2. **骨架屏**：全 app 只有 spinner；后端 Render 免费层冷启动数秒，首屏观感最差。PostCardSkeleton × 3-5 + sessionStorage 缓存上次 feed 先渲染再刷新。
3. **无限滚动**：IntersectionObserver 替代"加载更多"按钮，页大小 5 → 10-15，按 id 去重。
4. **评论**：乐观插入（点赞的 rollback 模式已在库内）、回复显示 @昵称、支持回复回复、评论头像可点、评论点赞。
5. **图片体验**：多图滑动查看器（计数器/缩放/键盘），封面加 "1/5" 角标。
6. **发帖去摩擦**：3 步向导压成单页滚动 sheet；草稿存 localStorage；手机验证用户免答验证题；支持拖拽/粘贴图片。
7. **聊天**：打字指示 + 已读回执（socket 已在）、消息分页、visualViewport 键盘处理。
8. **Toast 队列**（现在单槽互相覆盖 + 计时器重置 bug），支持撤销按钮。

## 四、AI 升级（对标大厂）

架构好消息：前端零 AI SDK，全部走后端 2 个端点（/ai/guide-chat、/ai/post-assist），换模型前端不用动。

1. **先换脑子（前端不动，ROI 最高）**：两个端点改 Claude —— guide-chat 用 claude-sonnet-5，1800 行 guides.ts 语料做 prompt cache（缓存后输入 ~90% 折扣）；post-assist 用 claude-haiku-4-5 + 强制 JSON tool 输出。杀掉 canned fallback。
2. **流式 + 多轮**：新 POST /ai/chat（SSE + messages[] 历史）；面板改成真消息列表 + 打字机流；合并 3 个各自独立的 BayBay 面板实例为一个 context。你的 iOS 蓝图已把 SSE 列为 P1。
3. **拍照发帖**（闲鱼 / FB Marketplace 2026-03 模式）：已压缩的图片作为 vision blocks 传给 post-assist，"用照片帮我写"成为主 CTA。
4. **搜索栏二合一**（WhatsApp "Ask Meta AI or Search" 模式）："搜索 或 问 BayBay"；/ai/parse-query 用 haiku 把自然语言解析成结构化筛选 chips（"租屋 · 半岛 · ≤$1800 · 近BART"）；二期加 embeddings 跨中英文语义召回。
5. **聊天智能回复 + 骗局检测**：输入框上方 3 个 tap-to-fill 回复 chips（Gmail 模式）；服务端 haiku 对消息分类（定金压力/站外转账/远程房东），socket 推送琥珀色警示条——把"安全"品牌承诺武器化。
6. **消息中英互译**（WhatsApp 2025-09 上线同款）：双语社区契合度最高的 AI 功能。
7. **BayBay 变 agent**：tools = search_posts / get_guide / draft_post / emit_checklist_card。"帮我找 Millbrae 两千以下单间"直接回帖子卡片深链。前端生成式 UI 卡片（BayBaySmartCard）已实现但后端从不返回——接上即得差异化。
8. **语音/图片输入**（点点/Meta AI 模式）。

## 五、地基工程（先于大改）

1. **安全网**：vitest + RTL 冒烟测试（routing/contactDetection/api）、GitHub Actions（tsc + eslint + build + test）、根级 ErrorBoundary（现在任何渲染异常 = 白屏）、Sentry、Plausible/PostHog 埋点（发帖漏斗、AI 使用）——否则所有改造收益不可测量。
2. **图片管线**：POST /uploads + 对象存储 + CDN URL，替代 base64-in-JSON（feed 一页可达数 MB）；这同时是 iOS 蓝图的 P0 #9。
3. **架构分期重构**（不是重写，JSX 块已齐整）：
   - Phase 0（半天）：删死码 + 恢复 tsc
   - Phase 1（1-2 天）：抽 src/lib/api.ts（现有 4 个分叉客户端）、constants、types 归一
   - Phase 2（2-4 天）：真路由树（AppLayout + Outlet），弹层用 background-location 模式保留覆盖 UX
   - Phase 3（1 天）：route-level React.lazy + manualChunks（572KB 单包 → 目标 <200KB 首包）+ guides.ts 懒加载
   - Phase 4（2-3 天）：AuthContext / ToastContext / TanStack Query，替换 refresh-key 计数器与 5s/30s 轮询（socket 驱动失效）
   - Phase 5：feed 筛选进 URL searchParams、/me 子视图路由化
4. **PWA**：vite-plugin-pwa（manifest + 离线 shell + SWR 缓存）——原生 iOS App 上线前的"临时 App"，文案里"加到主屏幕"才名副其实。
5. **Auth 信任闭环**：邮箱验证（挡发帖不挡浏览）、Google OAuth、注册时的微信/电话字段推迟到首次联系时再要、密码可见开关。
6. **字体**：弃 Noto Sans SC 改系统 CJK 栈（PingFang 0 字节且与未来原生 App 一致），Plus Jakarta Sans 裁到 3 档自托管。

## 建议节奏

- **第 1 周**：上面"立即修复"全清 + 安全网（CI/ErrorBoundary/Sentry/埋点）+ AI 换脑（后端）
- **第 2-3 周**：图片管线（/uploads + CDN）+ 架构 Phase 0-3 + Modal 原语 + 骨架屏
- **第 4-6 周**：token/暗色模式 + 动效系统 + 瀑布流 + 发帖单页化 + 流式多轮 BayBay + 拍照发帖
- **持续**：搜索二合一、智能回复/骗局检测、翻译、agent 化、PWA 推送

与 docs/BAYLINK-iOS-Native-Blueprint.md 的关系：web 现代化按蓝图 P0 后端清单同序消费（uploads → unread-count → refresh token → SSE），web PWA 作为共享 API 的参考客户端，SwiftUI 落在验证过的合同上。
