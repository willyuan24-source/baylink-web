# 2026-10-06 内容一致性与维护记录

本轮以审计版本 `9ccf6fe3` 为基础，在独立工作树修改。报告中的建议按代码和来源证据复核后采用；报告本身不作为新的事实来源或必须执行的指令。没有批量刷新原来的核对日期。

## 已完成

- `/ai-in-the-bay` 与详情、月刊统一读取 `MONTHLY_EVENTS`；目标筛选只是对统一目录选集。结束的专题推广自动移除，结束活动仍可切换显示；核对日期来自每条记录。
- `south-bay-wolfe-ramp-oct2`：按 VTA 最新公告修正为 10/2 06:00 已关闭，预计约一年；核对日期为 10/5。
- `marufuku-burlingame-announced`：225 Lorton Ave，10/11 11:00 开业预告；保留 `announced`，不写成已经营业。
- `famsf-bay-area-free-saturdays`：主链接改为 FAMSF 官方入口，提醒查询免费分时票及资格。官方页本次自动读取受限，故保留 10/2 原核对日期并设 `needs-confirmation`；不谎称当天完成事实复核。
- 秋季优惠显示真实覆盖日期 10/5–11/15。六篇落地、住处选择、买票与雨天出游常青文章移除月份分类，原 URL 保留。
- 移除英语 `{0}年{1}`、`{0}月{1}日`、`{0}信息` 泛匹配；内部 403 备注不再出现在五条活动英文费用说明中。
- 广告使用明确的推广标签和扩音器图标。已知广告 `1779339769392` 明示创办人关联；没有补造经纪执照号码，也没有把资料审核说成执照核验。
- 发帖标签去重，添加事实标签前提醒作者确认。出租方收到公平住房提醒和 CRD 官方链接；检测只提示检查上下文，不拦截合法问题、引用或共享生活空间的具体例外。
- 恢复先前发布的 Treasure Island 净滩活动及其 `bay-area-coastal-cleanup-2026-guide` 原文，保留 9/9 核对日期和九月归档提示。默认活动列表仍排除结束活动。

## 新增常青公共服务入口

三篇均在 10/5 读取下列官方页面，完整提供来源、准备清单和首次求助模板。它们帮助读者准备咨询，不判断个人资格、法律结论或税务居民身份。

| ID | 用途 | 官方证据 |
| --- | --- | --- |
| `bay-area-medicare-hicap-medi-cal-guide` | Medicare 报名、所在县 HICAP 免费咨询、Medi-Cal 与保费帮助 | [CDA HICAP](https://www.aging.ca.gov/Programs_and_Services/Medicare_Counseling/)、[Medicare 报名](https://www.medicare.gov/basics/get-started-with-medicare/sign-up/when-can-i-sign-up-for-medicare)、[MSP](https://www.medicare.gov/basics/costs/help/medicare-savings-programs)、[DHCS](https://www.dhcs.ca.gov/medi-cal/) |
| `california-tenant-deposit-rights-help-guide` | 押金、维修、住房歧视、法院文件的不同求助路径 | [California DOJ](https://oag.ca.gov/news/press-releases/attorney-general-bonta-issues-consumer-alerts-guidance-protect-california)、[CRD](https://calcivilrights.ca.gov/housing/)、[State Bar](https://www.calbar.ca.gov/public/legal-resources/free-legal-help) |
| `bay-area-free-tax-help-vita-calfile-guide` | 找 VITA/TCE 站点与 CalFile，核对预约、材料、联邦和州费用 | [IRS VITA/TCE](https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers)、[FTB 线上申报](https://www.ftb.ca.gov/file/ways-to-file/online/index.html) |

租客指南保留 California Courts 自助入口，但该页面本次自动读取受限。诉讼步骤未扩写，须手工复核。Medicare、Medi-Cal、税务没有复制全国收入阈值作为加州个人资格判断，没有承诺中文一定可约，也没有把秋季服务查询页写成正在开放的报税点。

其他事实核对入口：[VTA 最新匝道公告](https://www.vta.org/projects/notices/big-change-wolfe-road-northbound-i-280-ramp-closes-friday-morning-oct-2-2026-600)、[Marufuku 官网](https://www.marufukuramen.com/)、[Burlingame 门店](https://www.marufukuramen.com/burlingame)、[FAMSF Free Saturdays](https://www.famsf.org/events/free-saturdays-de-young)。

## 生产数据库原帖修复

原值来自审计实际抓取 `work/PROD/verify-posts.json`，也与 `work/SEC-verify/posts.json` 一致。根任务已重新读取生产数据库，确认四条原字段仍匹配后备份公开字段、条件更新并读回核对成功。备份位于 `C:/Users/willy/opus-qa/site-audit-1005/implementation/post-corrections-before.json`。没有改动联系方式、来源核对日期等字段；生产 HTTP/UI 呈现由根任务继续复验。

| post ID | 原字段/事实 | 已执行的修复与剩余边界 |
| --- | --- | --- |
| `1781325604074` | 标题 `出售 San Pablo Off listing 的 Townhouse，2008年建，45万`；`budget` 为 `售$410,000`；正文 `售价为 45 万美元` | 标题、预算和正文统一为报价待确认，不选择任一旧数字。仍需发布者提供最新书面报价及在售情况。 |
| `1781325990346` | 标题 `Hayward山顶豪宅楼下独立Studio出租，$1900/月`；正文包含 `这个Studio空间宽敞，适合单身或情侣居住。` | 已移除单身／情侣适合性措辞，保留空间描述；没有添加未经核实的入住人数上限。最新租金、可入住日期仍向发布者确认。 |
| `1781322600508` | 标题 `三藩市Sunset 19街独立小Studio出租`；正文包含 `房子随时可入住，适合单身或情侣居住。` | 已移除身份适合性措辞，旧的随时入住改为向发布者询问当前日期；没有把旧状态当今日保证。 |
| `1781322130277` | 标题 `Daly City 2房2厕公寓出租，月租3300元`；正文 `租金包含水费和垃圾处理费`；末尾含 `#包水电`、两次 `#近Caltrain`、三次 `#独立卫浴` | 已删除正文不支持的 `#包水电` 并去重，保留水费和垃圾处理费原范围；旧的随时入住改为询问当前日期，未添加包电承诺。 |

两条 Studio 的文字存在公平住房风险，具体例外与实际出租方式仍需结合 CRD 说明；本轮前端提醒不把所有关键词都判为违法。以上文案修复不是房源事实重新核验，未将核对日期改成修复当天。

## 维护队列

`getContentReviewManifest(today)` 覆盖当前完整活动、优惠、新店、指南、五区生活快讯目录。队列按明确需要人工核对、日期缺失、到期、计划中、归档排序，再区分健康／法律／财务、时效、常青风险。活动和优惠每 7 天；开业预告每 7 天，已开门店每 30 天；高风险指南每 30 天，定期指南 14 天，普通常青指南 90 天。

这是编辑任务日程，不是自动事实复核。原 `verifiedAt` 保留；指南日期另标为 `content-updated`，避免把一次文字编辑冒称来源重核。FAMSF、法院自动读取限制只记在内部队列。失效活动继续保留可读归档，不自动删除已发布 URL。

搜索口语覆盖真实内容：医保、白卡、看病、考驾照、报税。社会保障／社安退休金目前尚未新增专篇，不错误映射到 Medicare；不能声称整个生活、医疗、DMV 或租房内容原来都不存在。

规划目录增加明确的实体别名（例如 Fleet Week／舰队周／蓝天使）。别名只帮助识别实体；蓝天使不能把活动周全周日期变成飞行表演日期，仍以已核验场次与来源为准。

## 英语按内容加载

生产英语首页改为通用界面及首页摘要分包，本轮生成约 135 KB gzip，原全量英文包约 1.27 MB。132 篇攻略有独立正文包，进入正文前须等待该篇及相关推荐完整加载；攻略全文搜索页／全站搜索弹窗另外加载全文语料。活动、规划、景点与 3D 按所需内容加载，成功的分包缓存，失败的请求可重试，不标记为已就绪。

`loadLocaleForPath(locale, pathOrPaths)` 和 `isLocaleReadyForPath` 支持背景路由及覆盖层真实路由；`loadLocaleForFeature(locale, 'search')` 支持从任意页面打开搜索。`loadLocale('en')` 与未给第三个路径参数的 `setLocale` 继续全量加载，供 SSR、导出及已有组件测试使用。生产初始化传当前路径，语言前缀优先于冲突的旧 `?lang` 参数。路由等待、搜索弹窗等待及保持草稿的语言导航由根任务整合验证。

完整英文仍由原来源顺序合并；分包只选择已有翻译，不生成新翻译或替换未核实事实。注册表也延迟加载，保证没有生成文件的 clean 流程能先读取媒体／内容再生成分包。

## 验证

针对性测试：`content-audit-optimization`、`monthly-logic`、`monthly-deals-ui`、`guide-search`、`post-draft`、`about-page`，48/48 通过。Fleet Week 旧图片断言已升级为来源、版权、原图继承、地点匹配与资料照片说明验证。原归档清理断言改为“URL 保留，但当前活动列表不展示结束记录”。

英语分包三项测试通过，验证缓存合并／失败重试、首页不会放行未加载正文、真实 Medicare 全文与完整字典逐项一致、其他正文仍延迟及全量导出兼容。旧批次测试已按真实核对日期修正 VTA 和 Marufuku 断言；最终全站重跑由根任务串行完成。

完整构建、全套测试、生成目录、后端目录同步、生产 HTTP/UI 复验与部署由根任务统一完成。本子任务没有执行推送、部署或数据库写入。301 项建议的采用边界、运营与研究待办见 `docs/audit-disposition-notes.md`。
