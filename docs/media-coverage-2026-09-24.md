# BAYLINK 编辑内容图片覆盖审计 · 2026-09-24

本报告审计目前发布的静态内容数据。用户帖子图片与互动地图景点照片由本次任务的其他检查覆盖，不在下表重复计数。站内攻略、活动详情、月刊、优惠和新店页面共用同一媒体注册表。

## 前后对比

| 类型 | 条目数 | 修改前无图 | 修改后无图 | 修改前实拍封面 | 修改后实拍封面 |
|---|---:|---:|---:|---:|---:|
| 攻略与编辑文章 | 76 | 0 | 0 | 49 | 52 |
| 活动 | 93 | 30 | 0 | 6 | 30 |
| 优惠 | 55 | 0 | 0 | 14 | 14 |
| 新店资讯 | 14 | 0 | 0 | 6 | 6 |
| 月刊推荐地点 | 3 | 0 | 0 | 3 | 3 |

- 共 241 个已发布静态内容入口；76 篇攻略包含常青攻略、资讯与编辑文章。
- 30 条活动的 imageKey 原来是空字符串，月刊卡片和独立详情页均因此不显示图片。现已逐条配置主题或场地配图。
- 其他原有主图和响应式小图没有发现坏路径。所有 76 篇攻略原来都有封面，未把通用封面误统计成无图。
- 调整 4 篇攻略配图：Tilden 与 China Camp 封面改为已有真实场地照片；AI 活动周封面改为明确标注的数码学习主题实拍；SJ 数码帮助保留独立社区主题封面，数码学习照片放入正文。76 篇攻略仍保持封面源文件与图片字节各自唯一。
- 7 场 AI 技术活动改为数码主题资料照片；Oakland Civic Tech 保留社区日常主题插图。没有把同一张电脑照片描述为多个活动现场。
- 新增 8 张可复用授权资料/主题照片、16 个 WebP 主图与小图，共 2,279,742 字节。已经查看接触表确认画面与元数据一致。
- 共 159 个注册媒体对象；319 个唯一引用文件（含原版海报）检查通过。另用 Pillow 完整解码 317 个注册主图/响应式文件，无损坏。

## 来源与使用方式

| 媒体键 | 来源 | 作者与许可 |
|---|---|---|
| coverage-yerba-buena | [来源与授权](https://commons.wikimedia.org/wiki/File:Yerba_Buena_Gardens,_San_Francisco_2023-07-14-2.jpg) | The wub / CC BY-SA 4.0 |
| coverage-redwood-port | [来源与授权](https://commons.wikimedia.org/wiki/File:Redwood_City_port_aerial_view.jpg) | U.S. Army Corps of Engineers, photographer not specified or unknown / Public domain |
| coverage-rio-vista | [来源与授权](https://commons.wikimedia.org/wiki/File:Waterfront_Promenade_-_August_2025_-_Sarah_Stierch_01.jpg) | Missvain / CC BY 4.0 |
| coverage-petaluma-river | [来源与授权](https://commons.wikimedia.org/wiki/File:Petaluma_CA_Wooden_Bridge_over_Petaluma_River.jpg) | Colin Marquardt / Public domain |
| coverage-laptop | [来源与授权](https://commons.wikimedia.org/wiki/File:Laptop_and_a_mug_(Unsplash).jpg) | Ryan Riggins / CC0 |
| coverage-wine | [来源与授权](https://commons.wikimedia.org/wiki/File:Pair_of_wine_glasses.jpg) | Patrick Kennedy / CC BY 2.0 |
| coverage-stage | [来源与授权](https://commons.wikimedia.org/wiki/File:Redford_Theatre_auditorium_1.jpg) | Saul Vielmetti / CC BY-SA 4.0 |
| coverage-classic-car | [来源与授权](https://commons.wikimedia.org/wiki/File:Chevy_Bel_Air_in_the_Presidio_of_San_Francisco.jpg) | Frank Schulenburg / CC BY-SA 4.0 |

新照片均注明资料/主题用途和摄影来源；异地的品酒、剧场主题照片明确写明真实拍摄地，不能被理解为所述湾区活动现场。历史资料不代表当前设施或水上开放条件。CC BY/CC BY-SA 的授权链接与作者保留在页面，公有领域来源指向原始文件说明；转换仅缩放、压缩和按卡片比例展示。英文页面新增 alt、caption、credit 均有已注册的英文翻译。保留现有 AI 插图标识，未把插图称为真实景点。

## 持续检查

运行：

~~~powershell
npx tsx --tsconfig tsconfig.app.json scripts/audit-media-coverage.ts
npx tsx --tsconfig tsconfig.app.json --test tests/editorial-media-coverage.test.ts tests/monthly-image.test.tsx tests/local-discovery.test.tsx tests/guide-visuals.test.tsx
~~~

新增审计检查：每个当前内容入口都能解析图片、图片文件非空且 WebP 文件头正确、所有响应式候选都存在、图片尺寸与说明完整。图片缺失会让检查退出失败，不会被统一兜底掩盖。新增 event-image-usage.ts 显式登记资料图的 venue/theme 用途与允许使用的活动 ID，审计核对来源及非活动现场说明；未经登记的现场照片与海报仍禁止跨活动复用，同图改名伪装也仍由指纹检查阻止。

验证：图片覆盖、来源说明、英文翻译、月刊图片、内容详情和攻略图片组合回归 28 项通过；改动文件 ESLint 通过。最终合并后的完整测试、构建与浏览器验证由主任务记录。

## 最终审计结果

~~~json
{
  "summary": {
    "guides": {
      "total": 76,
      "missing": 0,
      "photos": 52,
      "illustrations": 24,
      "posters": 0
    },
    "events": {
      "total": 93,
      "missing": 0,
      "photos": 30,
      "illustrations": 60,
      "posters": 3
    },
    "offers": {
      "total": 55,
      "missing": 0,
      "photos": 14,
      "illustrations": 36,
      "posters": 5
    },
    "openings": {
      "total": 14,
      "missing": 0,
      "photos": 6,
      "illustrations": 6,
      "posters": 2
    },
    "places": {
      "total": 3,
      "missing": 0,
      "photos": 3,
      "illustrations": 0,
      "posters": 0
    }
  },
  "registeredImages": 159,
  "verifiedFiles": 319,
  "issues": []
}
~~~
