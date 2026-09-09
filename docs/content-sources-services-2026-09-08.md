# BAYLINK 服务类指南：来源与编辑核验

核验日期：2026-09-08。对应文件：`src/data/guides-services.ts`。

新增三篇原创中文指南，每篇六个章节、一组可勾选清单、一份可复制需求模板、一个实际分类发布入口。清洁、维修、翻译分别关联 `cleaning`、`repair`、`translation`，同时关联 `service`。本批不修改用户帖子，不生成商家身份、评价、联系方式或成交记录。

| 文章 | 正文汉字数（含清单与模板） | 官方来源 |
| --- | ---: | ---: |
| 在湾区找清洁：把工作范围写清楚，报价才有得比 | 970 | 2 |
| 家里东西坏了，怎么报修才少跑一趟？ | 1012 | 3 |
| 在湾区找翻译：先确认用途，再谈报价和交付 | 1081 | 3 |

字数按正文块中文字字符统计，不含英文缩写和标点。编辑建议、场景组织和模板为原创，不将其包装成官方规定。

## 官方资料核验

| 来源 | 已核验内容及正文用途 |
| --- | --- |
| [CDC：家庭清洁与消毒](https://www.cdc.gov/hygiene/about/when-and-how-to-clean-and-disinfect-your-home.html) | 阅读当前正文；采用按表面选择产品、遵循标签、区分清洁与消毒和避免混用产品等一般原则。未提供配药剂量或治疗建议。 |
| [EPA：Safer Choice 常见问题](https://www.epa.gov/saferchoice/frequently-asked-questions-safer-choice) | 阅读产品标签和成分审查说明；说明这是产品层面的标签，不将其当作清洁公司服务认证。 |
| [PG&E：燃气泄漏安全](https://www.pge.com/en/newsroom/safety-action-center/safety-resources/keep-yourself-safe-from-a-gas-leak.html) | 阅读撤离与联系紧急服务的行动说明；维修稿将安全行动放在报修步骤之前。未指导读者查找漏点、拆机或自行恢复供气。 |
| [CSLB：执照查询](https://web.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx) | 阅读官方查询页；提供按号码或经营名称核验状态的路径，不宣称替读者完成个别承包商背调。 |
| [CSLB：选择承包商](https://web.cslb.ca.gov/Consumers/Hire_A_Contractor/Finding_The_Right_Contractor.aspx) | 阅读相同工作范围的书面报价比较、身份与保险核验说明；仅对适用的承包工程使用。未写具体执照金额门槛、保证金或订金法律限额。 |
| [加州法院：口译员查询](https://languageaccess.courts.ca.gov/court-interpreters-resources/search-interpreter) | 通过官方域名的搜索索引正文核验；页面明确区分法院口译资质与书面翻译能力认证。直接抓取返回 403，未将其描述为所有网络环境都可直接访问。 |
| [加州法院：申请口译](https://selfhelp.courts.ca.gov/ask-interpreter) | 通过官方域名搜索正文核验法院申请及向联系人确认安排的流程；不延伸为自行聘用服务必获接受或报销。直接抓取未取得正文。 |
| [FTC：商家个人信息保护指南](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business) | 阅读最少收集、限制访问、保存与处置原则；将其转为给翻译服务方的资料处理询问项，不编造每家商家的实际安全措施。 |

## 取舍与仍需由当事人确认的内容

- 清洁项目名称、报价、上门时长、改期和返工窗口均由双方约定；清洁完成不保证押金退还。本文未制定湾区统一价格或服务标准。
- 维修稿只组织报修和选人信息，不诊断设备；执照、许可、保修与费用批准要按实际项目和物业要求核实。平台评价不等于资质核验。
- 翻译稿不提供移民、诉讼或其他个案判断，不承诺“认证翻译”一定被接受。不同接收机构可能要求不同材料，应保留该机构的官方说明或书面答复。
- USCIS 政策手册在本次工具抓取中返回 403；搜索另出现名称近似但不属于 `uscis.gov` 的网站，未采用这些来源，也未在稿件中写入 USCIS 规则。
- 三份模板均用方括号占位符，提醒公开内容避免详细地址及完整敏感文件；正式翻译资料不得因询价脱敏建议而擅自删改需要准确翻译的原文。

## 文件检查

使用 Node 原生 TypeScript 类型剥离成功导入三篇文章，核对导出数量、章节数、汉字数与来源数。单文件入口的 TypeScript 检查通过：`npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/data/guides-services.ts`。`template` 块由主任务统一提供复制交互，整体构建与页面验证由主任务整合后执行。
