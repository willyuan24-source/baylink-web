# BAYLINK 配图与网站介绍整理

日期：2026-09-16。状态：本地修改，尚未提交或部署。

## 检查与修补范围

初始审计覆盖 62 篇攻略、33 条优惠、55 条活动、11 家新店及 125 个注册素材。

- 攻略原有 62 张封面与 66 处正文插图都能解析，没有发现文件丢失或正文插图定位失败。
- 16 条优惠、39 条活动和 5 家新店没有配图。
- 活动、优惠、新店独立详情页未渲染主图，即使数据已有图片也不会展示。

本次补上 16 条优惠、29 条活动和 5 家新店配图；另纠正 SMCL 与 Alameda County 两条福利借用 SFPL 总馆照片的问题，改为明确的图书馆通行证主题插图。十月优惠、十月周末总览、San Jose 历史公园与农场、Tilden、China Camp、雨天博物馆共 6 篇攻略调整了 8 个封面或正文图片位置。

详情页现已复用攻略图片组件，支持响应式尺寸、来源说明与放大；官方海报和标记 fullFrame 的素材保留完整画面。新店列表也保留完整海报，并补上无来源链接的原创插画署名。

仍保留 10 条活动的纯文字布局：Petaluma 南瓜田、Rio Vista Bass Derby、Vacaville 彩色跑、Tiburon 品酒、Sonoma 品酒晚会、Oakland 音乐即兴、Petaluma 水上女巫、Novato 民间舞、Novato 经典车展与 San José Avenida de Altares。当前没有足够贴题的已核实素材；这些条目仍有标题、日期、地点、安排和官方入口，没有空白图片框或断图。

## 新增图片与来源

新增 13 张主图，每张附 480px 响应式版本，共 26 个 WebP 文件，存放于 `public/guides/community-2026/`。

### 7 张原创插图

使用内置 `image_gen`，没有调用 API/CLI 备用生成路径。逐张查看输出后，仅等比缩放和转换为 WebP；保留原始生成文件。

| 文件名（含同名 -small.webp） | 用途 |
| --- | --- |
| culture-visit.webp | 文化场馆福利与看展主题 |
| autumn-neighbors.webp | 秋季社区活动与周末总览 |
| cinema-night.webp | 室内影展 |
| outdoor-cinema.webp | 两场露天电影 |
| garden-walk.webp | 园林与茶园优惠 |
| family-workshop.webp | 亲子木作 |
| neighborhood-table.webp | 未取得合适现场图的新店餐饮主题 |

图片均标记为 AI 原创插图。公共主题插图可以复用，但不会标为某家场馆、店铺或活动实景。完整最终英文提示词与生成路径保存在 `output/editorial-media-manifest-2026-09-16.json`；公开元数据在 `src/data/community-editorial-media.json`。

### 3 张具体地点实景资料照

History Park（2010，CC BY 2.0）、Tilden Little Farm（2013，CC BY-SA 3.0）、China Camp 渔村（2010，CC BY-SA 3.0）。图片说明保留拍摄年份、作者、原图和许可链接。详见 [实景图片来源记录](community-place-photo-sources-2026-09-16.md)。

### 3 张商家官方资料图

| 文件名 | 来源页面 | 使用说明 |
| --- | --- | --- |
| opening-kaiyo-handroll.webp | [Kaiyō 活动页](https://www.kaiyosf.com/events) | 9/11 开业庆典海报，标明庆典已过，完整显示 |
| opening-marufuku-burlingame.webp | [Marufuku Burlingame](https://www.marufukuramen.com/burlingame) | 该店页的室内宣传图，不作为已经开业的证据 |
| opening-broken-dreams.webp | [Broken Dreams 官网](https://www.brokendreamsoakland.com/) | 店家发布的菜品资料照片，不承诺当前份量与供应 |

这些商家资料图没有被标为开放许可素材，保留商家归属及来源，用于对应新店消息的有限编辑展示。Mess Hall 官网 OG 是包含导航和营业文字的网页截图，本次未用作店铺照片。Hijau 使用明确标注的原创餐饮情境图，并将失效官网改为 [现有品牌网站](https://www.hijau.coffee/)。

## 网站介绍

新增公开 `/about` 页面，定位为“在湾区，把生活过得更熟悉”。内容按发现周末、生活攻略、实用工具和邻里联系整理，补充 BayBay 当前能力、信息来源与使用方式、反馈邮箱。

首页页脚、侧栏和个人页的访客／登录入口统一指向新介绍页；支持中英文与繁体转换，提供 SEO 元数据、结构化数据、预渲染与 sitemap。没有把尚未实现的社交提案写成现有功能。

## 验证记录

本轮使用浏览器核对本地页面与手机布局，未发送消息、提交报名或调用线上 AI。图片来源与许可核验记录见相关来源文档。

`npm run check` 完整通过：408 项测试、TypeScript、ESLint（0 错误，37 项既有警告）、生产构建、182 个公开预渲染页面和 161 张分享卡的图片尺寸／二维码验证。构建保留既有大分块警告。

浏览器核对了桌面与手机介绍页、英文介绍正文、手机优惠主图和放大、官方新店海报的完整显示。手机页面未检测到横向溢出，优惠图片使用 480px 小图。图片下方仍显示来源、资料年份或 AI 情境标记。本文验证以本地版本为准，线上网站尚未发布这些变更。

全量检查日志：`output/media-about-check-2026-09-16.log`。最终资产覆盖记录：`output/media-audit-after-2026-09-16.json`。生成提示词见 [原创配图提示词](media-generation-prompts-2026-09-16.md)。
