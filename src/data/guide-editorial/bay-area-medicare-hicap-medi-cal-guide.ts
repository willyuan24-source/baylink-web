import type { GuideEditorial } from './types';

// Facts from the article. CNT-GUIDES read Medicare.gov (2026 costs, sign-up window), the HICAP page and DHCS (four ways to apply,
// the asset-limit FAQ) on 2026-10-12; quotes in docs/source-reads-2026-10.md.
export const medicareEditorial: GuideEditorial = {
  slug: 'bay-area-medicare-hicap-medi-cal-guide',
  cover: {
    question: { zh: '快 65 岁，或在帮父母看医保？', en: 'Turning 65, or sorting out Medicare for a parent?' },
    title: { zh: '先打免费 HICAP 咨询，再选保险', en: 'Call free HICAP counseling before choosing a plan' },
    answer: { zh: 'HICAP 1-800-434-0222', en: 'HICAP 1-800-434-0222' },
    phone: { label: { zh: 'HICAP 免费咨询', en: 'HICAP free counseling' }, number: '1-800-434-0222', tel: '+18004340222' },
    line: { zh: '免费 · 保密 · 一对一 · 家属可一起准备', en: 'Free · confidential · one-on-one · family can help' },
  },
  keyFacts: [
    { label: { zh: '先打哪个电话', en: 'Who to call first' }, value: { zh: 'HICAP 免费咨询 1-800-434-0222', en: 'HICAP free counseling 1-800-434-0222' }, source: 1 },
    { label: { zh: '首次报名期', en: 'First sign-up window' }, value: { zh: '65 岁生日月前 3 个月到后 3 个月，共 7 个月', en: '3 months before to 3 months after the month you turn 65: 7 months' }, source: 2 },
    { label: { zh: '2026 年 Part B', en: 'Part B in 2026' }, value: { zh: '保费每月 $202.90，年度自付额 $283', en: 'Premium $202.90 a month, deductible $283 a year' }, source: 5 },
    { label: { zh: 'Medi-Cal 资产上限', en: 'Medi-Cal asset limit' }, value: { zh: '65 岁以上等：一人 $130,000（至 2027 年 6 月 30 日）', en: 'Age 65+ and others: $130,000 for one person (through June 30, 2027)' }, source: 7 },
    { label: { zh: '怎么申请 Medi-Cal', en: 'How to apply for Medi-Cal' }, value: { zh: '网上 BenefitsCal、打电话或到县办公室', en: 'Online at BenefitsCal, by phone or at a county office' }, source: 6 },
  ],
  contacts: [
    { name: { zh: 'HICAP 免费 Medicare 咨询', en: 'HICAP free Medicare counseling' }, number: '1-800-434-0222', tel: '+18004340222',
      note: { zh: '也可按居住县找办公室；预约时说明需要中文或口译。', en: 'Or find your county office; ask for Chinese or an interpreter when you book.' }, source: 1 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '先分清', en: 'First' }, title: { zh: '两个名字，不是同一张卡', en: 'Two names, two different cards' },
      items: [
        { zh: 'Medicare：联邦医保，通常与 65 岁或特定资格有关', en: 'Medicare: federal health insurance, usually tied to age 65 or other eligibility' },
        { zh: 'Medi-Cal：加州的 Medicaid，为符合规则的人提供免费或低成本保障', en: "Medi-Cal: California's Medicaid, free or low-cost coverage for those who qualify" },
      ] },
    { kind: 'point', kicker: { zh: '报名时间', en: 'When to sign up' }, title: { zh: '首次报名期共 7 个月', en: 'The first sign-up window is 7 months' },
      body: { zh: '从 65 岁生日所在月的前 3 个月开始，到生日月后 3 个月结束。错过又没有其他符合条件的保险，Part B 通常每晚一年保费多 10%。', en: 'It opens 3 months before the month you turn 65 and closes 3 months after it. Miss it without other qualifying coverage and the Part B premium typically rises 10% for each year late.' },
      items: [{ zh: '仍在工作、用配偶雇主保险、COBRA 或已有 Medi-Cal：先和 HICAP 排好日期', en: "Still working, on a spouse's employer plan, on COBRA or on Medi-Cal? Work out your dates with HICAP" }], source: 2 },
    { kind: 'compare', kicker: { zh: '2026 年费用', en: '2026 costs' }, title: { zh: 'Medicare 一年要付多少', en: 'What Medicare costs in 2026' },
      items: [
        { zh: 'Part B 保费：每月 $202.90（收入较高的人更多）', en: 'Part B premium: $202.90 a month (more at higher incomes)' },
        { zh: 'Part B 自付额：每年 $283', en: 'Part B deductible: $283 a year' },
        { zh: 'Part A 住院自付额：每个福利期 $1,736', en: 'Part A hospital deductible: $1,736 per benefit period' },
      ], source: 5 },
    { kind: 'checklist', kicker: { zh: '咨询前', en: 'Before counseling' }, title: { zh: '带上这些', en: 'Bring these' },
      items: [
        { zh: '生日月份、目前保险名称和结束日期', en: 'Birth month, current insurance and its end date' },
        { zh: '保险卡和收到的报名或续保通知', en: 'Insurance cards and any sign-up or renewal letters' },
        { zh: '药名、剂量、常用药房和想保留的医生', en: 'Drug names, doses, your pharmacy and the doctors you want to keep' },
      ] },
    { kind: 'checklist', kicker: { zh: 'Medi-Cal 资产', en: 'Medi-Cal assets' }, title: { zh: '2026 年起重新计算资产', en: 'Assets count again from 2026' },
      items: [
        { zh: '适用：65 岁以上、残障或住护理院', en: 'Applies to: age 65+, disability or nursing home' },
        { zh: '至 2027 年 6 月 30 日：一人 $130,000，每多一人加 $65,000', en: 'Through June 30, 2027: $130,000 for one person, plus $65,000 per extra person' },
        { zh: '2027 年 7 月 1 日起：一人 $21,000，两人 $31,000', en: 'From July 1, 2027: $21,000 for one, $31,000 for two' },
        { zh: '不计入：自住房、主要用车、家具衣物', en: 'Not counted: your main home, main vehicle, household items' },
      ], source: 7 },
    { kind: 'point', kicker: { zh: '费用帮助', en: 'Help with costs' }, title: { zh: '保费和药费，分别申请帮助', en: 'Apply for each kind of cost help' },
      items: [
        { zh: 'Medi-Cal：网上 BenefitsCal、电话、邮寄或到县办公室', en: 'Medi-Cal: online at BenefitsCal, by phone, by mail or at a county office' },
        { zh: 'Medicare Savings Programs：由州判断，觉得不符合也可申请', en: "Medicare Savings Programs: the state decides; apply even if you think you don't qualify" },
        { zh: '药费 Extra Help：请 HICAP 咨询员一起看', en: 'Extra Help with drug costs: go over it with HICAP' },
      ], source: 6 },
    { kind: 'safety', kicker: { zh: '保护资料', en: 'Protect your data' }, title: { zh: '这些不要发到公开帖子', en: 'Keep these out of public posts' },
      items: [
        { zh: 'Medicare 号码', en: 'Medicare number' },
        { zh: '身份证件、完整生日', en: 'ID documents, full date of birth' },
        { zh: '收入证明、保险卡照片', en: 'Income documents, photos of insurance cards' },
      ] },
  ],
  steps: [
    { zh: '先打 HICAP 1-800-434-0222 或按县找办公室，预约时说明需要中文或口译。', en: 'Call HICAP at 1-800-434-0222 or find your county office; ask for Chinese or an interpreter.' },
    { zh: '首次报名期是 65 岁生日月前后共 7 个月；先排好日期再选计划。2026 年 Part B 保费每月 $202.90。', en: 'The first sign-up window is the 7 months around the month you turn 65; set your dates before choosing a plan. The 2026 Part B premium is $202.90 a month.' },
    { zh: 'Medi-Cal 可网上、电话、邮寄或到县办公室申请；65 岁以上资产上限一人 $130,000（至 2027 年 6 月 30 日）。', en: 'Apply for Medi-Cal online, by phone, by mail or at a county office; for people 65+ the asset limit is $130,000 for one person through June 30, 2027.' },
  ],
};
