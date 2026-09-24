# 湾区资讯更新：2026 年 9 月 23 日至 10 月 31 日

## 内容变化

| 项目 | 更新前 | 清理 | 新增 | 当前 |
|---|---:|---:|---:|---:|
| 活动 | 55 | 10 | 20 | 65 |
| 优惠与本地福利 | 33 | 1 | 18 | 50 |
| 攻略 | 62 | 1 | 11 | 72 |
| 商家开业/迁址资讯 | 11 | 0 | 0 | 11 |

57 场活动与十月相交：旧金山 10、东湾 12、南湾 10、半岛 9、北湾 16；活动覆盖至 10 月 31 日。新增攻略包含 Muni/Clipper 付款更新，以及 Sunset Dunes、San Mateo 日本花园、Alviso、Ardenwood、Richmond、Martinez、Pleasanton、Marin、Sonoma、Napa 本地出行。

清理项目包括 Flower Piano、Newark Days、Bark in the Park、Lafayette Art & Wine、Mill Valley Fall Arts、Muni Heritage、Santa Clara Art & Wine、SF Autumn Moon、Treasure Island Coastal Cleanup、San Rafael Porchfest，以及 9/20 Yogurtland 优惠、已结束的海岸清洁日攻略。它们已从当前目录、搜索、公开路由、生成页面和 sitemap 中移除。历史活动源记录保留用于日期边界校验，不重新发布为当前活动。

同步更正 HSB 日程、BAMIF 开票状态、Fremont 儿童票价/年龄、FCC 成人陪同要求、Santa Clara 县公园通行证参与图书馆、Sonoma 美术馆旧闭馆提示。Florecita 原预计迁址日已过，保持“待确认”；Broken Dreams 营业时间矛盾明确提示电话确认。删除 Stanford 已结束导览暂停期及 Baylands 旧高温提醒，没有为整篇旧攻略伪造新核验日期。

## 来源与核验范围

- [活动来源与逐条日期复核](autumn-events-research-2026-09-23.md)：新增 20 条，既有 45 条未结束活动的核心日期复核完成，票务细节的核验限制逐条说明。
- [优惠来源与资格复核](autumn-offers-research-2026-09-23.md)：新增 18 条；原 33 条中 24 条主要规则复核、3 条部分复核、5 条读取受限、1 条到期删除。受限项目沿用原记录，没有把无法读取误写为取消或新确认。
- [攻略与图片来源](autumn-guides-research-2026-09-23.md)：11 篇攻略、11 张独立真实封面及响应式图片，完整中英文内容；资料图片明确标注来源与已知拍摄时间。

## 交付与验证

- 前端目录、BayBay 中英文检索目录与后端三个 catalog 同步；72 篇攻略、65 个活动 ID。
- 路由覆盖 72 篇攻略、126 个本地资讯详情；218 个 sitemap URL。
- 前端现有完整测试 408/408 通过；后端 103/103 通过，后端语法检查通过。
- 前端 TypeScript/Vite/预渲染构建通过；198 张分享卡尺寸及直达链接二维码校验通过；lint 无错误，保留既有 warning。
- 浏览器检查十月与半岛组合筛选、英文新增攻略、实景封面加载和当前桌面布局；本轮没有新增手机视口实测记录。
- 使用既有 main 分支 Git 发布集成，先同步 Render API，再发布 Vercel 前端。未修改域名、套餐、权限或用户发布的数据。

场次余票、商家库存、临时闭馆及将来的政策变更不等于本次日期复核结果；页面保留原始官方入口和具体限制，供出发前核对。
