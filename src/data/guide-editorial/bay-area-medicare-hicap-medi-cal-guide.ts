import type { GuideEditorial } from './types';

// Facts from the article (checked 2026-10-05): California Department of Aging HICAP, Medicare.gov and DHCS pages in its sources.
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
    { label: { zh: '首次报名窗口', en: 'First sign-up window' }, value: { zh: '65 岁生日月前三个月起，到生日月后三个月止', en: 'From three months before the month you turn 65 to three months after it' }, source: 2 },
    { label: { zh: '两个名字', en: 'Two different programs' }, value: { zh: 'Medicare 是联邦医保；Medi-Cal 是加州的 Medicaid', en: "Medicare is federal health insurance; Medi-Cal is California's Medicaid" } },
    { label: { zh: '保费和药费压力', en: 'Help with premiums and drugs' }, value: { zh: '问 Medicare Savings Programs 和药费 Extra Help，资格由州核对', en: 'Ask about Medicare Savings Programs and Extra Help; the state decides eligibility' }, source: 3 },
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
    { kind: 'point', kicker: { zh: '报名时间', en: 'When to sign up' }, title: { zh: '首次报名：生日月前后各三个月', en: 'First sign-up: three months either side of your birthday month' },
      body: { zh: '多数人的首次报名窗口从 65 岁生日所在月前三个月开始，到生日月后三个月结束。', en: 'For most people the first window opens three months before the month they turn 65 and ends three months after it.' },
      items: [{ zh: '仍在工作、用配偶雇主保险、COBRA 或已有 Medi-Cal，处理方式可能不同', en: "Still working, on a spouse's employer plan, on COBRA or on Medi-Cal? It may work differently" }], source: 2 },
    { kind: 'checklist', kicker: { zh: '咨询前', en: 'Before counseling' }, title: { zh: '带上这些', en: 'Bring these' },
      items: [
        { zh: '生日月份、目前保险名称和结束日期', en: 'Birth month, current insurance and its end date' },
        { zh: '保险卡和收到的报名或续保通知', en: 'Insurance cards and any sign-up or renewal letters' },
        { zh: '药名、剂量、常用药房和想保留的医生', en: 'Drug names, doses, your pharmacy and the doctors you want to keep' },
      ] },
    { kind: 'point', kicker: { zh: '费用帮助', en: 'Help with costs' }, title: { zh: '保费和药费，分别问清帮助项目', en: 'Ask about each kind of cost help' },
      items: [
        { zh: 'Medicare Savings Programs：由州判断资格', en: 'Medicare Savings Programs: the state decides eligibility' },
        { zh: '药费 Extra Help：请咨询员核对', en: 'Extra Help with drug costs: ask your counselor' },
        { zh: 'Medi-Cal 申请和规则：看 DHCS 官方入口', en: 'Medi-Cal applications and rules: the DHCS site' },
      ], source: 3 },
    { kind: 'safety', kicker: { zh: '保护资料', en: 'Protect your data' }, title: { zh: '这些不要发到公开帖子', en: 'Keep these out of public posts' },
      items: [
        { zh: 'Medicare 号码', en: 'Medicare number' },
        { zh: '身份证件、完整生日', en: 'ID documents, full date of birth' },
        { zh: '收入证明、保险卡照片', en: 'Income documents, photos of insurance cards' },
      ] },
  ],
  steps: [
    { zh: '先打 HICAP 1-800-434-0222 或按县找办公室，预约时说明需要中文或口译。', en: 'Call HICAP at 1-800-434-0222 or find your county office; ask for Chinese or an interpreter.' },
    { zh: '多数人首次报名窗口是 65 岁生日月前后各三个月；先核对自己的日期再选计划。', en: 'For most people the first window is three months either side of the month they turn 65; check your dates before choosing a plan.' },
    { zh: '保费和药费压力分别问 Medicare Savings Programs 和 Extra Help，资格由州核对。', en: 'For premiums and drug costs, ask about Medicare Savings Programs and Extra Help; the state checks eligibility.' },
  ],
};
