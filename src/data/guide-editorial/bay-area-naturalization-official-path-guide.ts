import type { GuideEditorial } from './types';

// Facts from the article (edited 2026-10-06 from USCIS documents; several USCIS pages returned 403 and need a manual read).
export const naturalizationEditorial: GuideEditorial = {
  slug: 'bay-area-naturalization-official-path-guide',
  cover: {
    question: { zh: '绿卡几年可以入籍？', en: 'When can a green card holder naturalize?' },
    title: { zh: '先确认申请路径，再整理材料', en: 'Confirm your path, then gather documents' },
    answer: { zh: '一般路径：永久居民满 5 年', en: 'Usual path: 5 years as a permanent resident' },
    line: { zh: 'N-400 · 考试版本 · 长者语言例外', en: 'N-400 · test version · language exceptions for older applicants' },
  },
  keyFacts: [
    { label: { zh: '一般路径', en: 'Usual path' }, value: { zh: '年满 18 岁、永久居民至少 5 年', en: 'Age 18 or older and a permanent resident for at least 5 years' }, source: 3 },
    { label: { zh: '公民配偶', en: 'Spouse of a citizen' }, value: { zh: '符合完整条件时可能走 3 年路径', en: 'A 3-year path may apply if every condition is met' }, source: 2 },
    { label: { zh: '公民知识考试（2025 版）', en: 'Civics test (2025 version)' }, value: { zh: '题库 128 题；口试最多问 20 题，答对至少 12 题通过', en: '128 questions; up to 20 asked, pass with at least 12 correct' }, source: 5 },
    { label: { zh: '长者英语例外', en: 'English exceptions by age' }, value: { zh: '50 岁且永久居民 20 年，或 55 岁且 15 年，可能免英语，仍考公民知识', en: '50 with 20 years as a resident, or 55 with 15 years, may skip English but still take civics' }, source: 6 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '年限是入口', en: 'Years are the start' }, title: { zh: '两条常见路径', en: 'Two common paths' },
      items: [
        { zh: '一般路径：年满 18 岁，永久居民至少 5 年', en: 'Usual path: 18 or older, 5 years as a permanent resident' },
        { zh: '公民配偶：符合完整条件时可能 3 年', en: 'Spouse of a citizen: possibly 3 years if every condition is met' },
        { zh: '还要核对连续居住、实际在美时间和品行等条件', en: 'Continuous residence, time in the U.S. and good moral character also count' },
      ], source: 3 },
    { kind: 'checklist', kicker: { zh: '填表前', en: 'Before the form' }, title: { zh: '先把事实整理好', en: 'Put the facts in order' },
      items: [
        { zh: '绿卡居民起始日期，住址、工作或就学时间线', en: 'Green card start date; where you lived, worked or studied' },
        { zh: '每次出境与返美日期', en: 'Every departure and return date' },
        { zh: '婚姻、子女、税务、司法记录的真实材料', en: 'Real records for marriage, children, taxes or any court matters' },
      ] },
    { kind: 'point', kicker: { zh: '考试', en: 'The test' }, title: { zh: '2025 版公民知识题库', en: 'The 2025 civics question bank' },
      items: [
        { zh: '题库 128 题', en: '128 questions in the bank' },
        { zh: '一般口试最多问 20 题', en: 'Up to 20 asked at the interview' },
        { zh: '答对至少 12 题通过', en: 'Pass with at least 12 correct' },
      ], body: { zh: '先按 N-400 递交日期确认适用的考试版本。', en: 'Check which version applies by your N-400 filing date.' }, source: 5 },
    { kind: 'point', kicker: { zh: '年长申请人', en: 'Older applicants' }, title: { zh: '英语例外：年龄和年限要同时满足', en: 'English exceptions need both age and years' },
      items: [
        { zh: '50 岁 + 永久居民 20 年：可能免英语', en: '50 + 20 years as a resident: English may be waived' },
        { zh: '55 岁 + 15 年：可能免英语', en: '55 + 15 years: English may be waived' },
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
    { zh: '一般路径是永久居民满 5 年，公民配偶可能 3 年；居住、出境和品行等条件也要逐项核对。', en: 'The usual path is 5 years as a permanent resident, possibly 3 for a citizen\'s spouse; residence, travel and character still need checking.' },
    { zh: '先整理住址、出入境和材料时间线，再按当前 N-400 说明书填写。', en: 'Build your address, travel and document timeline, then fill in the current N-400.' },
    { zh: '按递交日期确认考试版本；2025 版口试最多问 20 题，答对 12 题通过。', en: 'Check the test version by filing date; the 2025 version asks up to 20 questions and you pass with 12.' },
    { zh: '法律资格判断找执业律师或获认证代表，先核实资格再付费。', en: 'For legal questions use a licensed attorney or accredited representative; check them before you pay.' },
  ],
};
