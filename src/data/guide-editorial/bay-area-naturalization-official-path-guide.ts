import type { GuideEditorial } from './types';

// Facts from the article. CNT-GUIDES read the USCIS N-400 page (fees $760 / $710 / $380) and Study for the Test (2025 test for
// filings on or after 2025-10-20; 2008 test before) in a browser on 2026-10-12; quotes in docs/source-reads-2026-10.md.
export const naturalizationEditorial: GuideEditorial = {
  slug: 'bay-area-naturalization-official-path-guide',
  cover: {
    question: { zh: '绿卡几年可以入籍？', en: 'When can a green card holder naturalize?' },
    title: { zh: '先确认申请路径，再整理材料', en: 'Confirm your path, then gather documents' },
    answer: { zh: '一般路径：永久居民满 5 年', en: 'Usual path: 5 years as a permanent resident' },
    line: { zh: 'N-400 · 考试版本 · 长者语言例外', en: 'N-400 · test version · language exceptions for older applicants' },
  },
  keyFacts: [
    { label: { zh: '一般路径', en: 'Usual path' }, value: { zh: '年满 18 岁、永久居民满 5 年', en: 'Age 18 or older and 5 years as a permanent resident' }, source: 1 },
    { label: { zh: '公民配偶', en: 'Spouse of a citizen' }, value: { zh: '满 3 年，另有婚姻和共同生活等条件', en: '3 years, with further conditions on the marriage and living together' }, source: 1 },
    { label: { zh: 'N-400 申请费', en: 'N-400 filing fee' }, value: { zh: '纸本 $760，网上 $710；减费 $380', en: '$760 on paper, $710 online; reduced fee $380' }, source: 1 },
    { label: { zh: '公民知识考试', en: 'Civics test' }, value: { zh: '2025 年 10 月 20 日起递交：2025 版，20 题答对 12 题', en: 'Filed on or after October 20, 2025: the 2025 test, 12 of 20 correct' }, source: 4 },
    { label: { zh: '长者英语例外', en: 'English exceptions by age' }, value: { zh: '50 岁且永久居民 20 年，或 55 岁且 15 年，免英语，仍考公民知识', en: '50 with 20 years as a resident, or 55 with 15 years: no English test, civics still required' }, source: 6 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '年限是入口', en: 'Years are the start' }, title: { zh: '两条常见路径', en: 'Two common paths' },
      items: [
        { zh: '一般路径：年满 18 岁，永久居民满 5 年', en: 'Usual path: 18 or older, 5 years as a permanent resident' },
        { zh: '公民配偶：满 3 年，另有婚姻和共同生活条件', en: 'Spouse of a citizen: 3 years, plus conditions on the marriage and living together' },
        { zh: '还要核对连续居住、实际在美时间和品行等条件', en: 'Continuous residence, time in the U.S. and good moral character also count' },
      ], source: 1 },
    { kind: 'checklist', kicker: { zh: '填表前', en: 'Before the form' }, title: { zh: '先把事实整理好', en: 'Put the facts in order' },
      items: [
        { zh: '绿卡居民起始日期，住址、工作或就学时间线', en: 'Green card start date; where you lived, worked or studied' },
        { zh: '每次出境与返美日期', en: 'Every departure and return date' },
        { zh: '婚姻、子女、税务、司法记录的真实材料', en: 'Real records for marriage, children, taxes or any court matters' },
      ] },
    { kind: 'compare', kicker: { zh: '考试', en: 'The test' }, title: { zh: '按递交日期分两版', en: 'Two versions, by filing date' },
      items: [
        { zh: '2025 年 10 月 20 日或以后递交：2025 版，从 128 题中问 20 题，答对 12 题通过', en: 'Filed on or after October 20, 2025: the 2025 test, 20 questions from 128, pass with 12' },
        { zh: '之前递交：2008 版，从 100 题中最多问 10 题，答对 6 题通过', en: 'Filed earlier: the 2008 test, up to 10 questions from 100, pass with 6' },
      ], body: { zh: '涉及现任官员的答案，面试前到 USCIS 查看更新。', en: 'Check USCIS for answer updates about current officials before the interview.' }, source: 4 },
    { kind: 'point', kicker: { zh: '申请费', en: 'Fees' }, title: { zh: 'N-400 申请费', en: 'The N-400 fee' },
      items: [
        { zh: '纸本递交 $760', en: '$760 on paper' },
        { zh: '网上递交 $710', en: '$710 online' },
        { zh: '减费 $380 或免费：只能纸本递交', en: 'Reduced fee $380 or a waiver: paper only' },
      ], source: 1 },
    { kind: 'point', kicker: { zh: '年长申请人', en: 'Older applicants' }, title: { zh: '英语例外：年龄和年限要同时满足', en: 'English exceptions need both age and years' },
      items: [
        { zh: '50 岁 + 永久居民 20 年：免英语', en: '50 + 20 years as a resident: no English test' },
        { zh: '55 岁 + 15 年：免英语', en: '55 + 15 years: no English test' },
        { zh: '65 岁 + 20 年：公民知识另有特别考虑', en: '65 + 20 years: special consideration for civics' },
      ], source: 6 },
    { kind: 'safety', kicker: { zh: '找对帮助', en: 'The right help' }, title: { zh: '法律判断交给有资格的人', en: 'Legal advice from qualified people only' },
      body: { zh: '执业律师或司法部认可机构的获认证代表；“保证通过”不代表 USCIS 的决定。', en: 'A licensed attorney or an accredited representative; a promise to pass is not a USCIS decision.' },
      items: [
        { zh: '不在公开帖子上传绿卡、护照或 A-Number', en: 'Never post your green card, passport or A-Number' },
        { zh: '不把 USCIS 账号密码给陌生人', en: 'Never give your USCIS password to anyone' },
      ], source: 7 },
  ],
  steps: [
    { zh: '一般永久居民满 5 年，公民配偶满 3 年；连续居住、出境和品行等条件也要逐项看。', en: 'Usually 5 years as a permanent resident, 3 for a citizen\'s spouse; continuous residence, travel and character count too.' },
    { zh: '先整理住址、出入境和材料时间线，再按当前 N-400 说明书填写；申请费纸本 $760、网上 $710。', en: 'Build your address, travel and document timeline, then fill in the current N-400; the fee is $760 on paper or $710 online.' },
    { zh: '2025 年 10 月 20 日起递交的人考 2025 版：问 20 题，答对 12 题通过；之前递交的考 2008 版。', en: 'Filed on or after October 20, 2025: the 2025 test, 20 questions, pass with 12; earlier filers take the 2008 test.' },
    { zh: '法律资格判断找执业律师或获认证代表，先核实资格再付费。', en: 'For legal questions use a licensed attorney or accredited representative; check them before you pay.' },
  ],
};
