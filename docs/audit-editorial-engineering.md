# 月刊读取与并行检查调整

本批在 `codex/audit-editorial-polish` 工作树实施，范围为 ENG-17、3D-12/ENG-04 的检查编排，以及 PAGE2-12 的两处页面文案。未推送、部署、调整平台保护或进行真实账号操作。

- 月刊默认按日期展示时，只请求已显示活动的意向计数。首批六项，展开后补十二项；当前账号会话内保留已读取数据，窗口重新聚焦或用户重试会重新读取当前范围。账号或 token 改变仍重新建立会话，旧响应不能覆盖新会话，确认的写入仍受版本保护。
- 热门、找搭子、我的想去仍读取全目录，并等待完整批次成功后显示排序或筛选结果。失败不以零人数或零匹配代替未知；API 每批上限和完整响应验证保留。
- 月刊五处眉题和工具页眉题改为明确的简体、繁体、英文。未修改全局翻译或阅读 token；本批不代表全站装饰文案已经整理完成。
- CI 的站点测试、3D 测试、完整构建与产物检查并行执行。每条测试轨先运行原 `pretest` 生成准备；没有按修改路径跳过测试。原名 `check` 保留为始终执行的汇总，三个前置任务均为 success 才通过。构建任务使用现有 `release:hosting`，保留 lint、依赖审计、全部构建、分享卡、周报和发布产物检查。本地 `npm run check` / `release:build` 仍运行完整测试。
- runner 递归发现测试，两个集合互斥并且合并等于全部测试。检查当时实际文件为489个（站点201、3D288）；该数字随后续新增测试变化，以实际集合验证为准。保留所有3D与回退测试。

定向验证：新增四项月刊网络/筛选行为回归和两项测试集合/CI门禁回归通过；39项参与意向、API批次、日历、工具交互和CI回归通过；TypeScript构建检查、改动文件ESLint通过。另已验证SSR、分页、无App上下文、完整热门/个人/搭子筛选的既有行为。失败切回普通列表后现在会异步重读该范围，原测试已改为等待该读取结算，再断言显示不可用、不捏造零人数。

完整月刊历史套件的早期运行因全量DOM遍历较久且使用修改前测试，已停止；不将该运行计为通过。后续已完成整文件验证，见下方测试成本复核。最终整站检查由根任务在整合后执行。本批未实际执行GitHub Actions，未验证所有托管平台手动发布入口，也未进行生产网络/浏览器性能测量。真实供应商送达、邮件周报与全目录来源人工核验仍待后续证据；未来覆盖报表和单篇指南复核见下方第二批记录。

# Content follow-up — 2026-10-07

- `npm run report:content-coverage -- --start 2026-10-07 --weeks 8` reads the real monthly catalog and the same date overrides as the public calendar. `--weeks` accepts 4–8; omitted start uses the current Pacific date. JSON and Markdown are written to ignored `artifacts/content-coverage/`, and CI uploads them as `content-coverage` after the full release checks.
- Reports separate distinct event IDs, distinct `(ID, date)` pairs and distinct calendar dates. Explicit occurrence lists (including empty lists) override ranges. Range-derived days are labelled separately and do not claim verified daily openings or timed sessions. The same event can appear in multiple weeks; weekly unique counts cannot be added to get a window total. Duplicate IDs are excluded with a diagnostic.
- This snapshot contains 418 catalog IDs; 318 appear in the 56-day window, with 618 event-days across 56 calendar dates. Of 240 region/category/week cells, 114 are empty. The 2026-11-18 week has 2 distinct events, and the 2026-11-25 week has 6. These are catalog observations for editorial follow-up, not coverage targets or evidence that no other local activities exist. Gaps and data diagnostics print an advisory without failing the release.
- The existing P0 `bay-area-commute-guide` is the only older guide refreshed in this batch. It now has five practical steps, direct planning links, a door-to-door trial template, missed-departure and late-return alternatives, and a registered complete English dictionary. Traditional Chinese uses the existing converter. Its 2026-10-07 `updatedAt` means article update; no other article/source date was renewed.
- Official pages actually read on 2026-10-07: [BART apps](https://www.bart.gov/guide/apps), [Caltrain how to ride](https://www.caltrain.com/rider-information/how-ride-caltrain), [VTA Transit app](https://www.vta.org/go/transit-app). The claims are limited to these planning and boarding instructions. No personal route, fare, parking availability or real-time trip was tested. This is not a blanket re-verification of the source registry.
- New coverage/commute tests plus the existing CI-lane tests: 9 passed. They cover DST, duplicate occurrence dates, explicit empty overrides, kind/category mapping, malformed records, real-catalog parity with the public calendar, three-language content compatibility, stable guide identity and complete test-lane coverage. Targeted ESLint and `tsc -b` passed. Full integration/build evidence belongs to the final shared revision.

## 测试成本与安全复核

- 独立复跑会话轮换、登录切换、旧读写抑制、批量完整响应、覆盖统计、CI 集合共 29 项，全部通过。计数缓存只存在于 `user.id + token` 作为 key 的会话组件内；切换账号、退出和同账号 token 轮换都会重新建立缓存。后台读取带 abort 和 request serial，写入带 revision，旧响应不能回滚确认写入。
- 本次只读盘点时 494 个测试文件恰好划为 site 206 + opus 288，后续新增优惠测试也由递归发现纳入 site；不是冻结文件清单。完整构建、依赖审计、所有产物门禁仍在 release job，原 `check` 汇总必须等待三个 job 成功。尚未把这次本地检查表述为最终提交的 GitHub CI 通过。
- 月刊文件并非 effect 无限循环。独立全目录用例 95.85 秒完成；临时日志确认 35 次分页持续前进，后续逐卡可访问名称与样式计算占主要成本。改为在已知卡片/筛选容器内查询，并直接核对原生语义、ARIA 名称、文案、URL、图片与来源属性后，同用例独立运行 20.39 秒通过。没有删测试或删目录条目。
- 改后整份 `monthly-ui.test.tsx` 26/26 通过，用时 173 秒；在同期完整站点任务负载下，最重单项为 32.74 秒。保持 418 个活动的归档可达、全部分页和过滤断言，以及 SSR、详情展开、热门/个人/搭子完整计数。临时诊断副本已删除，原根任务测试进程未终止。
- 覆盖窗口的 618 日期对分为 245 显式日期对、373 区间推导日期对；未发现同标题同日期重复。统计对象是公开目录的不同 ID，不宣称不同主办项目数。八周不重复累计同 ID 的条目数，日期覆盖和条目覆盖不能混用。

## 三条当天优惠的实际复核

`src/data/offers-reviewed-2026-10-07.ts` 只覆写 Marin Transit Clean Air Day、SF Zoo 居民免费日、Target Circle Deal Days 三条的说明与 `verifiedAt`。原始历史批次保留；三条结束日期仍为 2026-10-07，Target 同源的另一条新会员优惠没有被顺带更新。记录中的官方 URL 与证据实际于 10 月 7 日读取，英文独立字典已登记。

- [Marin Transit 官方免票安排](https://marintransit.gov/fare-free-promotions)：明确 10/7 本地公交全体乘客免票，不延展到其他运营方。
- [SF Zoo 免费日](https://www.sfzoo.org/calendar/sf-resident-free-day-5/) 与 [票务说明](https://www.sfzoo.org/tickets-hours/)：活动窗口 10:00–16:00，每份显示 SF 居住地址的政府证件对应一人，停车另列收费。通用网站页头闭园时间不改变活动窗口。
- [Target Corporation 发布稿](https://www.prnewswire.com/news-releases/target-circle-deal-days-returns-with-major-savings-on-stylish-fall-and-holiday-finds-302878903.html)：活动日期 10/6–7，免费 Circle 会员购买指定服饰/美妆有对应折扣；未实测库存、购物或结账。

新回归验证太平洋日期在 `2026-10-08T07:00:00Z` 跨入 10/8 后，三条从有效优惠列表移出，复核队列转为 archived。10/7 当前队列为 829 条内容、335 due、4 manual-review、2 missing-date、130 archived。这是编辑队列状态，不是全部事实已获人工确认。

根任务统一重新生成英文后，四份优惠测试（`offers-reviewed-oct7`、`october-refresh-offers`、`retail-perks-2026`、`official-offers-oct5`）最终 20/20 通过，无跳过或 TODO；三条现行文案均匹配生成后的英文词典。相关改动的 ESLint 与 `tsc -b` 也已通过。此前一次生成读取到 Target 旧文案 key 的并发时点失败已由此次完整复跑消除，不将早期失败运行计为通过。

## 本轮后应优先继续的原报告条目

1. **CNT-04：补真实未来供给。** 八周预警已实现；11/18 周只有 2 个目录 ID、11/25 周只有 6 个，仍需持续从官方公告补齐区域/类别供给。验收看新增来源、真实日期和更新后覆盖报表，不把任意数量目标当发布门槛。
2. **CNT-03：逐项事实复核与处理闭环。** 三条当天优惠及通勤文已复核，但 4 条人工访问限制和其他到期记录仍需编辑证据。登记来源、抓取成功、审核按钮和事实更新是四件不同的事；验收需条目级来源、实际改动、复核人/时间与发布证据。
3. **EDIT-06 / EDIT-14：剩余早期 P0 内容与标签。** 通勤文已补五步、官方入口和试跑模板；仍有 8 篇 P0 保留 5–6 月日期，`GuideCard` 仍把 P0 一律显示为「新手必看」（目录 P0 共 26 篇）。应逐篇补任务步骤、证据和三语文案，并用明确编辑语义决定标签，而不是批量改日期。
4. **SEO-11 / PROD-06 / COMM-02：周报和事务通知分别验收。** 周末 PNG/JSON/ICS 已有；通知 topic 仍只有 message/contact_request/outing_request，没有定期邮件周报的订阅与发送。事务通知的 provider 接受状态也不是收件箱实际送达；真实送达、退订证据需要运营验收，不能由本地测试代替。
5. **ENG-15：可定位的性能/异常告警。** 当前浏览器观察器仍主要记录粗粒度 `client_error`；后续应补脱敏异常、release 关联、Web Vitals 和真实接收端告警演练。已通过的完整 CI 与这类生产可观测性是不同验收项。
