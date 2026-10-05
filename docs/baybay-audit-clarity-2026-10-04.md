# BayBay 日常服务与回答清晰度审计

审计日期：2026-10-04（America/Los_Angeles）。起始前端提交：`c0bd8473`。本次只做两次公开、合成问题的真实线上请求；请求相隔约 86 秒，均 HTTP 200，没有 429。未使用个人资料或登录凭证。脱敏请求、完整回答及研究状态保存在 [JSON 证据](baybay-audit-clarity-2026-10-04.json)。UTC 请求日期为 10 月 5 日，对应湾区 10 月 4 日晚。

## 结论

新居民 DMV 回答能区分办理类型、明确未知条件并引用官方资料，但办理期限和材料清单仍不够完整。图书馆问题没有完成用户要求的资格比较，而是返回重复且截断的站内摘录；其 `degraded: false` 与真实回答内容不一致。两条结果不能支持“日常服务全面通过”的结论。

本轮已修复五类前端问题：长回答自动滚到末尾、免费门票与未定义的零预算重复、检索范围被误当成实际引用范围、服务需求误导入出游计划、来源时间戳被丢弃且核验方式未区分。相关回归 55/55 通过，改动文件 ESLint 通过。DOM 测试证明交互分支，不代替真实浏览器视觉验证，也不证明模型回答质量。

## 两次真实请求

| 场景 | 用时 | 实际引用 | 评价 |
| --- | --- | --- | --- |
| 刚搬到 Fremont：驾照、车辆登记、地址变更的办理顺序、期限和材料 | 43.5 秒 | 3 个 DMV 官方入口、1 篇站内指南 | 部分达到目标；不编造豁免或个体能否驾驶，但关键期限及材料未完成 |
| Fremont 居民仅持 Alameda County Library 卡：打印、Kanopy、博物馆票的资格比较 | 51.0 秒 | 2 篇站内指南，实际引用站外来源为 0 | 未达到目标；缺少打印回答、重复摘录、中途截断、地点状态错误 |

请求均使用 `assistantVersion: 2`、`searchMode: smart`、`locale: zh-Hans` 和 `context: { currentPath: '/' }`，调用公开 `/api/ai/guide-chat`。为尊重共享配额，未追加重试或其他场景；离题问题、未知时事、英文真实生成尚未实测。

### DMV：谨慎，但行动清单尚不完整

回答将三项手续分开，建议按各自期限并行办理；明确已有加州 DMV 记录的地址更新不能代替首次申请驾照；区分外州、外国、无驾照等情况。它没有凭外国驾照推断用户当前可合法驾驶，也没有虚构预约时段。

回答准确引用了地址变更 10 天及带入车辆登记 20 天的官方说明。它明确称未从已读正文确认新居民申请驾照期限，因此没有把搜索摘要当成核验结论；这种表达诚实，但仍未满足用户要求。材料部分也停留在身份、地址、姓名一致性等大类，未形成可实际准备的分项清单。

官方交叉检查：

- [DMV 新居民入口](https://www.dmv.ca.gov/portal/driver-education-and-safety/special-interest-driver-guides/new-to-california/)支持带入车辆的 20 天规则及新居民驾照申请入口；车辆具体类别仍需分支核查。
- [DMV 更新驾照或 ID 信息](https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/updating-information-on-your-driver-license-or-identification-dl-id-card/)支持地址变更 10 天、免费线上／邮寄／现场办理。
- [DMV 在线申请](https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/dl-id-online-app-edl-44/)及[驾驶手册申请准备](https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/getting-an-instruction-permit-and-drivers-license/)可以补足在线开始、到场完成和材料清单。
- [DMV FFDL 5 PDF](https://www.dmv.ca.gov/portal/file/fast-facts-5-requirements-for-a-california-drivers-license/)是“新居民 10 天内办理驾照”可继续核查的官方线索。该 PDF 的发布时间较早，不能仅凭它在本报告直接给个人作现行法律判断。

建议回归：同一个问题分别以无驾照、外州驾照、外国驾照、已有加州驾照为前提；答案应分别列出已核实步骤和待确认条件，不能用“需核实”替代已找到官方正文中的所有实际步骤。

### 图书馆：失败回退被包装成正常结果

真实回答首句称“当前无法完成个性化综合分析”，随后粘贴两篇站内指南的部分内容。第一段在“每月额度以当前登”处截断，第二段重复 SFPL Kanopy。用户明确问的打印没有被回答；“SFPL 官方入口”旁的引用实际跳到站内指南，而不是直接的官方服务入口。

研究状态记录 `preferred_model_timeout`、`answer_scope_rejected` 和补充联网不可用；最终使用回退模型，然而 `degraded` 仍为 `false`。检索状态为 `site+web/completed`，实际引用只有两篇站内攻略。前端现已明确展示“已检索站内与站外 · 实际引用 2 条站内资料、0 条站外来源”，但无法仅靠这个标签修复回答内容或错误的降级状态。

此外，任务状态把 `city` 设为 San Francisco、`region` 设为 sf，只将 Fremont 放在 origin。用户是在比较图书馆资格，提及 SFPL 不等于指定出游目的地；错误城市可能影响后续追问和推荐。

官方交叉检查：

- [San Mateo County Libraries Print Anywhere](https://smcl.org/printanywhere/)明确每天最多 25 页免费打印，双面每一面计一页，到所选同一分馆取件。该打印规则应与博物馆票的居住资格分开说明。真实研究记录显示已成功读取此页，但回答遗漏它。
- [SMCL Discover & Go FAQ](https://smcl.org/faq/museum-passes-discover-go/)分别说明服务区域、16 岁门槛、eCard／机构卡限制及预约条件；这些规则不能套用于所有馆内资源。
- [Alameda County Library 卡与 eCard FAQ](https://aclibrary.org/faq/library-cards-ecards/)包含 Discover & Go 服务区域、15 岁门槛、eCard 限制，以及持卡人的每日免费打印额度入口。此次未独立核实每种打印的具体免费页数，不应臆造。
- 搜索中 Alameda Free Library（Alameda 市）和 Alameda County Library 容易混淆。没有确认 County 的 Kanopy 入口时，不应把市图书馆权益冒充成县图书馆权益。

建议后端回归：按“已有卡现在可用／需另办卡／卡种与居住限制”回答；每项服务分别核验资格；禁止半句截断；回退必须与 `degraded` 一致；信息比较不应自动推断目的地；失败研究仍可清楚呈现已读官方页面中可确认的事实。

## 本轮已修复的前端问题

1. **答复滚动位置** — `src/components/BayBayAssistantEntry.tsx:89`。原先每次更新滚动到整个会话底部，长答复正文被移出首屏。现在提交时定位最新问题，完成时定位答复开头；等待期间手动上滚会停止自动跟随，下一次明确提交才恢复。错误／取消也定位相应状态。回归：`tests/baybay-conversation.test.tsx:20`、`:38`。
2. **免费条件与年龄** — `src/components/BayBayAssistantPlan.tsx:25`。`freeOnly && budget === 0` 且预算范围未定义时，保留免费门票条件，隐藏误导性的零预算；明确总预算／每人预算仍保留。年龄显示“5 岁”或对应英语。简体、繁体和英文均有覆盖。
3. **检索与实际引用** — `src/components/BayBayDiscoveryResults.tsx:20`。助手标签分别报告检索范围与经过解析的引用数量，包括实际引用 0 条站外来源；原有联网失败警示保留。测试覆盖搜过网页但只引用站内，以及中英繁体文字。
4. **服务流程的行动出口** — `src/components/BayBayAssistantEntry.tsx:184`。服务搜索、匹配帖子以及发布服务流程不再显示“带着这些需求，继续做计划”。发布服务动作仍可使用；活动／出游、已有计划及 transit 场景的相应入口保留。回归：`tests/baybay-conversation.test.tsx:337`。根代理实测水管服务查询没有虚构商家，但显示无关攻略；无关攻略筛选由根代理负责后端修复，不计为本子任务已验证通过。
5. **来源日期与获取方式** — `src/lib/baybay-assistant.ts`、新增 `src/components/BayBayEvidenceStamp.tsx`。原解析只接受 YYYY-MM-DD，真实响应中的 ISO 时间戳全部丢弃（修复前，两条响应中原有时间戳分别 11→0、2→0）。现在保留经校验的时间戳，显示时按 America/Los_Angeles 转换，不截取 UTC 日期；日期本身仍按原日期显示。回答来源和计划引用统一区分“资料快照／网页读取／接口获取／搜索线索（未读正文）”，避免把目录记录说成实时核对。回归包括夏令时 UTC 次日→湾区前日、正时区偏移、冬令时、非法闰日／日期／时钟／无时区以及三种语言。

## 仍需处理或验证

| 优先级 | 位置 | 发现与影响 | 建议 |
| --- | --- | --- | --- |
| P1 | 真实图书馆回答及研究状态，见 JSON 第二条 | 重复／截断的回退回答、遗漏已读的打印事实，`degraded: false`；Fremont 居住条件被误转为 SF 目的地 | 修复回退、条件保留和按问题组织证据；以真实场景重跑，不能只用 mocks 宣布解决 |
| P3 | `src/components/BayBayAssistantPlan.tsx:75` | 计划的失败检查和未知条件在默认折叠的“出发前检查”内，摘要不显示待确认数量 | 可在摘要显示未确认／需调整数量；这是静态可发现性问题，本轮未进行真实计划 API 检验 |
| 测试缺口 | `src/components/BayBayDiscoveryResults.tsx:33` 及相关 CSS | 答案作为保留换行的段落展示；本次两条都是纯文本，未证明 Markdown 标题／列表、非常长的引用标题、窄屏长答复和读屏播报可读 | 用真实样例做窄屏与辅助技术检查，继续保留 citation URL 校验与编号测试 |

日期／核验类型问题在根代理确认后纳入本轮修复；没有修改后端。

## 验证与范围

执行以下三个测试文件，单并发，55/55 通过：

```text
tsx --tsconfig tsconfig.app.json --test --test-concurrency=1 tests/baybay-conversation.test.tsx tests/baybay-assistant-v2.test.tsx tests/baybay-discovery-session.test.tsx
```

七个改动 TS/TSX 文件 ESLint 通过。相关既有测试继续覆盖取消请求、IME 输入、隔离会话、引用地址校验、表单信息保留、计划预算未知值和需用户明确触发的导入动作。未运行全量构建，未提交或发布；浏览器由根代理独占，本子任务没有操作浏览器。修复后的真实布局仍交由根代理复验。
