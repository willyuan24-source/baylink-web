# BAYLINK 内容与配图审核 — 2026-10-05

核对日期按 America/Los_Angeles。此报告区分生产基线、旧工作区、正在制作的修复；不把内部结构检查称为对每个外部来源的重新事实核查。

## 生产基线与版本保护

生产域名为 https://www.baylink.us。2026-10-05 匿名读取的 `baybay-guides.json`、`event-catalog.json`、`planner-catalog.json`、`discovery-context.json`、`discovery-context.en.json`，与 fetch 后 `origin/main` 提交 `9d675d12acb4961272b9dff2f25f2df5a62ce677` 内的对应文件逐项 JSON 完全一致。五组规范化 JSON SHA-256 也一致。证据：`output/site-audit-2026-10-05/origin-production-comparison.json`。

桌面原工作区 HEAD 为 `9664a3c1`，含大量未提交工作；它只有 107 篇指南、113 场活动、86 条优惠及 20 家新店。生产已经有 128 / 408 / 194 / 56。旧工作区三份 retail 数据没有接入聚合，但生产已经接入；不能据此告诉用户“50 条全部未上线”，也不能从旧工作区直接构建覆盖生产。本轮以生产匹配提交创建独立 `official-freebie-photos` 工作树。

`/offers/ulta-birthday-2026` 实测 404 是旧工作区的非生产 ID；生产使用 `roundup-ulta-birthday-gift-2026`。不是“生产缺少 Ulta 福利”的证据。生产的生日指南返回 200。

## 修复前全站机器清点

下表按编辑内容实际引用次数统计主图，不把不同页面重复使用同一张照片算成不同资产。“照片”包括带原始署名的历史资料照片及官方产品照；不等于当期活动实拍。

| 内容集合 | 总条数 | 照片 | 海报 | AI 插图 | 当前或未结束 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 指南封面 | 128 | 82 | 0 | 46 | 125；3 篇往期版 |
| 活动 | 408 | 53 | 3 | 352 | 327；81 已结束 |
| 优惠 | 194 | 33 | 5 | 156 | 171；23 已结束 |
| 新店 | 56 | 6 | 2 | 48 | 38 已营业、5 试营业、13 预告 |
| 城市近期资讯 | 101 | 5 | 0 | 96 | 独立资讯或官方日历入口 |
| 区域公告 | 13 | 5 | 0 | 8 | 未逐项重新确认有效期 |
| 月刊常驻去处 | 3 | 3 | 0 | 0 | 3 |

截至 10/5，171 条未结束优惠中有 138 条仍引用 AI 图（80.7%）；327 场未结束活动中有 286 场引用 AI 图（87.5%）。优惠卡中 `neighborhood-table` 重复 28 次、`family-workshop` 22 次、`culture-visit` 21 次、`everyday` 20 次、`september-freebies` 17 次。用户感受到高度重复、缺乏真实感，有明确的数据依据。

共有 252 个已注册图像键、504 份响应式图像文件。原有媒体检查的 missing、空文件、损坏 WebP、缺少署名/来源等结构问题为 0；但“有文件、有署名”不能保证“这幅图真实对应这件事”，原检查没有拦住大量事实卡使用泛化 AI 插画。

原始统计保存在 `output/site-audit-2026-10-05/baseline.json`；旧工作区只保留在 `old-workspace-baseline.json` 作为对照。不要用修复后的运行结果覆盖这份 baseline。

## 内容、日期与重复检查

- 对全部目录检查：指南 slug、活动 ID、优惠 ID、新店 ID 均无重复；生产所有对应公共路由均有配置。
- 408 场活动没有“官方 URL + 起止日期”完全相同的重复条目。对可明确匹配日期的 `MM/DD 周X` 文案未发现星期错误。此规则不覆盖自然语言复杂日期范围。
- 4 组福利共用同一条款页，分别是生日/加料、新会员/生日、汉堡/注册圣代、欢迎礼/生日礼；权益不同，不应仅按 URL 去重。
- 81 场已结束活动、23 条已结束优惠仍保留历史 URL；默认活动筛选、FreebieBoard 与月刊推荐会排除已结束项目。`history-smc-free-oct2` 另有 `needs-confirmation`，不会进入当前福利板。保留历史页本身不是错误。
- 21 条优惠缺独立 `verifiedAt`，其中 12 条未结束。不要为统一展示自动填今天；只有重新核实后才补日期。
- 当前优惠的“无需购物 / 需预约 / 需消费”静态异常筛查未找到足够证据可直接翻转的条目。过往消费、满额、买一赠一、自动配送折扣等已分为需消费。没有把动态库存、个人券或门店参与状态说成已验证。
- 月刊优惠区只有 3 张按结束日期排列的预览，其他优惠主要进入专题指南与搜索。194 条已收录并不保证读者能迅速看到刚新增的限时门店活动；入口与筛选的可发现性仍是重点。

## 外部来源抽查与明确修正

这部分是高风险样本复核，不是 408 场活动、194 条优惠和 128 篇指南逐句联网重审。

1. [Tilden Nature Area 官方公告](https://www.ebparks.org/parks/tilden-nature-area)：公众投喂已停止，Loop Road 9/21 至十月下旬工作日 8:00–16:00 作业，Laurel Canyon Trail 上段关闭。本站十月 Tilden 指南和日常福利已经明确不再喂动物；没有重新加回旧版“带生菜/芹菜”建议。
2. [Chowder Fest 官方页](https://www.fishermanswharf.org/chowderfest/)：10/24 12:00–17:00，普通参加免费，品尝套票收费。不能把免费进场说成免费喝浓汤。现有活动的分层收费与此一致。
3. [The Passdoor 官方活动页](https://thepassdoor.squarespace.com/new-events-1/santarosagrandopening)明确 10/1–3 的开业庆典；[官网当前活动与联系页](https://www.thepassdoor.net/new-page)已列 Santa Rosa 地址、营业时段及后续活动。原 `announced` 和庆典预告已落后；修正为已营业信息、庆典已结束，不把庆典日编造成首次接客日。官网各页营业时段不一致，文案保留到店前联系确认。
4. [Woods 官网](https://www.woodsbeer.com/)未提供足够证据确认渔人码头已接客；Hedley 官网本轮抓取超时，Florecita 官网提取不到可核实正文。不能用“日期已经过去”推断已经开门。Hedley / Woods 的九月预告改成明确的过期预告与状态待确认，保留原核对日期。

上述三家开业文案补丁在 `src/data/content-audit-updates.ts`，新英语映射在 `content-audit-oct5-en.json`。Lowe’s、Dunkin、Target、Michaels 等新优惠和官方图片的逐项证据由本轮专项研究文件记录，本报告不重复宣布其结果。

### 12 条未结束但缺独立核验日期的优惠

补查结果：10 条可用当前官方正文或官方页面搜索索引复核，写入 `CONTENT_AUDIT_OFFER_UPDATES` 的 `verifiedAt: 2026-10-05`；两条 CHICHA 保留原资料和待复查状态，不为齐全而填日期。下面是条款复查，不代表实时库存、预约余位、个别账户资格或每一家门店已经确认。

| 优惠 ID | 官方依据 | 10/5 处理 |
| --- | --- | --- |
| `lowes-kids-lollipop` | [Lowe’s Kids Club 与 FAQ](https://www.lowes.com/diy-projects-and-ideas/workshops) | 确认注册 Kids Profile、到店棒棒糖和数量有限；补核验日期。 |
| `ikea-family-hot-drink` | [IKEA US Family](https://www.ikea.com/us/en/ikea-family/) | 确认每次到店的会员咖啡或茶福利；补核验日期，餐厅时段仍需自查。 |
| `starbucks-cafe-refills` | [Starbucks 美国/加拿大堂食说明](https://about.starbucks.com/back-to-starbucks/) | 页面搜索索引完整列出同次堂食续杯及品类排除；直接提取正文不完整，交叉核对 [官方杯具说明](https://about.starbucks.com/a-better-cup-for-all/)。补日期，不扩展到拿铁或离店后续杯。 |
| `lowes-firefighting-plane-oct17` | [Firefighting Plane 活动](https://www.lowes.com/events/register/firefighting-plane)及 [官方工作坊 FAQ](https://www.lowes.com/diy-projects-and-ideas/workshops) | 确认 10/17 10:00–13:00、预约、4–11 岁建议及成人陪同；补核验日期。 |
| `yogurtland-anniversary-oct20` | [2026 周年活动条款](https://www.yogurtland.com/news_posts/view/86/celebrating-20-years-of-yogurtland-anniversary-promo-how-you-can-join-the-fun) | 2026 每月 20 日店内八折，Real Rewards 可当天加入；排除线上、外送、礼卡、catering 和叠加券。补日期。 |
| `svma-free-wednesdays-october` | [SVMA Visit](https://svma.org/visit/)与[当前展览](https://svma.org/) | 每周三 11–17 免费、前台签到、13 岁以下成人陪同；十月 7/14/21/28 日期正确。补日期。官网另有 10/17 提前闭馆及 10/22、29 私人活动闭馆，均不是所列免费周三。 |
| `smcl-discover-go` | [SMCL 当前 FAQ](https://smcl.org/faq/museum-passes-discover-go/) | 确认服务区域、16 岁以上、正式卡、两项预约、打印后不能取消及本人证件。移除当前 FAQ 未支持的硬编码卡号前缀，改为核对所属图书馆与地址资格；补日期。 |
| `alameda-county-discover-go` | [AC Library 卡片 FAQ](https://aclibrary.org/faq/library-cards-ecards/) | 确认服务区域居民、15 岁以上、正式卡，eCard 不能使用 Discover & Go；补日期。 |
| `santa-clara-library-parks-pass` | [县公园借票页](https://parks.santaclaracounty.gov/library-parks-pass)及 [FAQ](https://parks.santaclaracounty.gov/library-parks-pass/faq) | 确认可借三周、参与图书馆、核载不超过 15 人车辆/公路摩托车；不含 Uvas Canyon、Sunnyvale Baylands、露营或其他公园系统；补日期。 |
| `chicha-norcal-birthday-bogo` | [北加官方 Instagram 原贴](https://www.instagram.com/chichasanchen.norcal/p/DVUxImmkci8/) | 原贴本次无法读取；[官方门店页](https://chichasanchennorcal.com/locations)只确认六店地址，不能据此确认生日 BOGO 的每笔上限等条款。保留原核查说明，不新增核验日期。 |
| `chicha-cupertino-free-tea-tasting` | [官方主页](https://chichasanchennorcal.com/)与[预约页](https://chichasanchennorcal.com/reservation/ola/services/lishan-oolong-tea-tasting) | 官网可确认免费梨山茶体验、五种焙火风味，门店页可确认地址；动态预约正文未能重新读取，无法确认 15 分钟、英语、提前到场等全部细节。保留原预约限制，不新增完整条款核验日期。 |
| `amc-stubs-tuesday-wednesday-base-ticket` | [AMC 半价日条款](https://www.amctheatres.com/50pct-off-tuesdays-and-wednesdays) | 确认免费 Insider 可用、成人晚场基础价、每放映日 10 张上限，税/手续费/格式和特别活动附加费排除。移除来源 URL 的追踪参数并补日期。 |

这些变化不改变已结束活动或优惠的日期，也不把 `ongoing` 解读为永不失效。最终缺核验日期的数量应在聚合后重新计算；不能用修复前 12 条继续声称本轮未处理。

## 配图修复范围与显示原则

本轮事实性列表采用 `getListingImage` / `getOfferImage`：有可追溯照片或海报时展示；暂时没有合适真实图片时使用文字卡，不再以 AI 插图填满活动、新店和福利列表。概念性生活指南可继续使用明确标注的插图。落实的页面、构建和线上验收由发布记录确认，不能仅凭本报告视为已发布。

`src/data/verified-place-media-updates.ts` 提供 10 个真实场地照片别名，对应 25 个活动 ID；包括 8 场 SFPL 总馆活动、4 场 Napa 图书馆活动，以及 Ardenwood、Sonoma Barracks、Hiller、B Street、Yerba Buena Gardens、Ferry Building 等。另将 CHM 十月免票和 Rosie 免费参观改为已有对应场地照片。

每个别名继承原始照片的作者、授权、来源、尺寸与文件路径，只补充明确的历史场地图注；不冒充 2026 活动现场、成品、具体房间或集合点。独立脚本验证了 26 个活动修正 ID（25 个照片图注映射、1 个文字卡修正）、2 个优惠 ID 唯一存在，10 个照片来源均为有 HTTPS 来源的 photo。没有用 Cantor 冒充 Anderson、用 San Mateo 日本花园冒充 SF 日本茶园。

严格的共享照片回归还抓到一个既有错配：San Mateo 居民碎纸回收日在 Beresford Park，原来却使用 B Street 街景。此卡改为文字卡，保留日期、免费居民资格及三箱限制，并测试实际页面不再渲染错配照片。Fleet Week 原用渔人码头照片与其已列场地相符；改用同一文件的已审别名，图注明确 2016 年街区资料、不是 2026 年 Fleet Week 现场。

### 整合后的目录统计

2026-10-05 整合后运行 `audit-final.ts`，结果为 `output/site-audit-2026-10-05/after.json`。此统计按页面共用的 `getListingImage` 返回值计数，文字卡不是缺图错误；真实浏览器截图及线上发布验证需另看发布记录。

| 内容集合 | 整合后总条数 | 展示照片 | 展示海报 | 文字卡 | 展示 AI 插图 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 指南封面 | 128 | 90 | 2 | 0 | 36 |
| 活动（含已结束历史页） | 408 | 76 | 3 | 329 | 0 |
| 优惠（含已结束历史页） | 206 | 52 | 14 | 140 | 0 |
| 新店 | 56 | 6 | 2 | 48 | 0 |

- 未结束优惠由 171 条增至 183 条，新增 12 条；照片或官方海报由 33 条增至 60 条（48 张照片、12 张海报），其余 123 条使用文字卡。未结束优惠的真实照片/官方海报覆盖率由 19.3% 升至 32.8%，原 138 条 AI 配图不再显示。
- 未结束活动仍为 327 场，真实场地照片由 41 场增至 61 场（12.5% 升至 18.7%），其余 266 场使用文字卡。照片中的场地是真实的，不表示活动现场已经发生。
- 10 条补充官方条款核验后，未结束优惠缺 `verifiedAt` 仅剩上述两条 CHICHA；没有对无法访问的条款填入新日期。
- 新店状态为 39 已营业、5 试营业、12 预告；Passdoor 的状态变化是有官方营业信息支持的修正。
- 36 个指南封面仍为有标签的插图，清单保存在 `after.json` 的 `illustratedGuides`。它们包括租房/安全/入学等说明性指南，也仍包括部分出行集合、SJ Access 与 SCCLD 图书馆说明；缺少对应实图时没有借用其他城市馆舍或虚构产品照片。不应概括成“全站所有图片都已换成真实照片”。

## 发布与后端同步

- 前端仓库 `willyuan24-source/baylink-web`：现有 main Git 集成触发 Vercel；`vercel.json` 使用 `npm run build`、输出 `dist`。最新 `prebuild` 会生成 sitemap 并同步公共路由；需要完成 TypeScript、相关测试、构建与图片检查后再推送并读取部署状态。
- 后端仓库 `willyuan24-source/baylink-api`：服务为 https://baylink-api.onrender.com，既有 main 部署至 Render。当前远端基线 `3adaf5d83b4dc285a0f761c77f4dc0b6acecb883`。
- 后端实际读取 `data/guide-catalog.json`、`data/guide-catalog.en.json`、`data/event-catalog.json`、`data/planner-catalog.json`；前端对应指南导出名为 `public/baybay-guides*.json`。不要按文件名直接误覆盖。
- 最新后端没有 `discovery-context*.json`，也没有读取它的代码；优惠通过指南正文进入 BAYBAY 检索。前端 discovery 导出仍须随构建更新，但添加一个后台未读取的 JSON 不能宣称完成 AI 同步。
- 本轮独立后台工作树为 `C:/Users/willy/OneDrive/Desktop/baylink-api-freebie-catalogs-20261005`、分支 `codex/official-freebie-catalogs`；不覆盖桌面旧后端工作树。依赖安装通过，0 个 npm audit 漏洞。最终前端导出已复制到后台实际使用路径，中英指南各 128 条、活动 408 条，没有删除或重复 ID；planner 从 408 场活动及 91 个场地变成 408 + 92，新增已确认营业的 Passdoor 场地。四个复制文件均与前端字节一致，event-catalog 只有换行差异，无 Git 语义变动。
- 重点后台回归：`guide-catalog-refresh.test.js`（品牌检索保留优惠条件和官网）、`guide-local-recommendations.test.js`、`november-guide-retrieval.test.js`、`planner-catalog.test.js`；最终执行后端检查与测试，并比较前后 ID 集合防止掉条目。

后台验证完成：原有 35 项重点回归及新增中英 14 项优惠检索回归全部通过；新增断言覆盖消费门槛、奖励不是保证获赠、活动区分及周一/周三/周日限制与官方来源同处一个不超过 9,000 字符的模型片段。全套 `npm test` 995/995 通过，`node --check server.js` 与 `git diff --check` 通过。后台提交 `42b9bdebb0aeff5b328e0cd735d7f75260bf6a32` 已按授权以普通 fast-forward 推至 main；推前 fetch 确认远端基线未变。

同步证据与结果位于 `output/site-audit-2026-10-05/backend-catalog-sync.json`、`backend-targeted-tests.log`、`backend-full-tests.log`。没有向后端添加无人读取的 discovery-context 文件，也没有变更数据库、账号或运行时密钥。

Render 随后完成更新：实际 `GET https://baylink-api.onrender.com/api/health` 返回 200、`status: ok`，运行提交精确匹配 `42b9bdebb0aeff5b328e0cd735d7f75260bf6a32`。证据：`backend-live-health.json`。这确认服务进程已运行包含同步目录的新提交；上述新优惠的检索语义通过本地真实目录回归验证，没有把一次 health 请求说成逐条生产 AI 对话验证。前端 Vercel 发布及浏览器验收由主发布记录另记。
