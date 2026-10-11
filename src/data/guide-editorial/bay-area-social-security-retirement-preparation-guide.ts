import type { GuideEditorial } from './types';

// Facts from the article (read 2026-10-06): SSA credits, estimate, retirement age, first payment, SSI and interpreter pages.
export const socialSecurityEditorial: GuideEditorial = {
  slug: 'bay-area-social-security-retirement-preparation-guide',
  cover: {
    question: { zh: '准备退休，社安金怎么领？', en: 'Getting ready to claim Social Security?' },
    title: { zh: '先查工作记录，再选领取月份', en: 'Check your work record, then pick the month' },
    answer: { zh: 'SSA 1-800-772-1213', en: 'SSA 1-800-772-1213' },
    phone: { label: { zh: 'SSA（可要求免费中文口译）', en: 'SSA (free interpreter on request)' }, number: '1-800-772-1213', tel: '+18007721213' },
    line: { zh: '工作积分 · 领取年龄 · 免费口译', en: 'Work credits · claiming age · free interpreter' },
  },
  keyFacts: [
    { label: { zh: '资格门槛', en: 'Eligibility' }, value: { zh: '通常需要 40 个工作积分，每年最多四个', en: 'Usually 40 work credits, at most four a year' }, source: 1 },
    { label: { zh: '领取年龄', en: 'Claiming age' }, value: { zh: '最早 62 岁；1960 年及以后出生者完全退休年龄 67 岁；延后增额通常到 70 岁', en: 'From 62; full retirement age 67 if born 1960 or later; delayed increases usually stop at 70' }, source: 4 },
    { label: { zh: '何时申请', en: 'When to apply' }, value: { zh: '最早在领取月份前四个月；首笔一般在下一个月到达', en: 'Up to four months before the start month; the first payment usually comes the month after' }, source: 5 },
    { label: { zh: '联系 SSA', en: 'Contact SSA' }, value: { zh: '1-800-772-1213，可要求免费中文口译', en: '1-800-772-1213; ask for a free Chinese interpreter' }, source: 7 },
  ],
  contacts: [
    { name: { zh: '社会保障局 SSA', en: 'Social Security Administration' }, number: '1-800-772-1213', tel: '+18007721213',
      languages: [{ zh: '免费中文口译', en: 'Free Chinese interpreter' }],
      note: { zh: '向接线员说明需要中文口译；是否需要办公室预约由 SSA 说明。', en: 'Tell the operator you need a Chinese interpreter; SSA will say whether you need an office appointment.' }, source: 7 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '先分清', en: 'First' }, title: { zh: '你问的是哪一种福利？', en: 'Which benefit are you asking about?' },
      items: [
        { zh: '社会保障退休福利：看缴税的工作记录', en: 'Social Security retirement: based on your taxed work record' },
        { zh: 'SSI：收入和资源有限者的另一项福利', en: 'SSI: a separate benefit for limited income and resources' },
        { zh: '401(k)、IRA、雇主计划：各有自己的规则', en: '401(k), IRA, employer plans: their own rules' },
      ] },
    { kind: 'point', kicker: { zh: '工作积分', en: 'Work credits' }, title: { zh: '通常需要 40 个工作积分', en: 'Usually 40 work credits' },
      body: { zh: '每年最多四个；不是在美国住满十年就自动取得。更多积分不等于更高月领金额。', en: 'At most four a year; living here ten years does not earn them automatically. More credits do not mean a bigger check.' }, source: 1 },
    { kind: 'point', kicker: { zh: '领取年龄', en: 'Claiming age' }, title: { zh: '62、67、70 三个年龄', en: 'Three ages: 62, 67, 70' },
      items: [
        { zh: '62 岁：最早领取，月领金额降低', en: '62: the earliest claim, with a lower monthly amount' },
        { zh: '67 岁：1960 年及以后出生者的完全退休年龄', en: '67: full retirement age if born 1960 or later' },
        { zh: '70 岁：延后领取的增额通常到此为止', en: '70: delayed increases usually stop here' },
      ], source: 4 },
    { kind: 'point', kicker: { zh: '申请与到账', en: 'Applying and payment' }, title: { zh: '领取月份和到账月份不同', en: 'Start month and payment month differ' },
      items: [
        { zh: '最早在希望开始领取的月份前四个月申请', en: 'Apply up to four months before the month you want to start' },
        { zh: '首笔一般在所选领取月份的下一个月到达', en: 'The first payment usually arrives the month after' },
        { zh: '延后退休金不等于可以延后 Medicare 报名', en: 'Delaying your benefit does not delay Medicare sign-up' },
      ], source: 5 },
    { kind: 'contacts', kicker: { zh: '联系 SSA', en: 'Contact SSA' }, title: { zh: '可以要求免费中文口译', en: 'Ask for a free Chinese interpreter' },
      phones: [{ label: { zh: '社会保障局', en: 'Social Security' }, number: '1-800-772-1213', tel: '+18007721213' }],
      items: [
        { zh: '先在官方账号逐年比对工作收入', en: 'Compare your yearly earnings in your official account first' },
        { zh: '本人福利和家庭福利分别问', en: 'Ask about your own and family benefits separately' },
      ], source: 7 },
  ],
  steps: [
    { zh: '退休福利看工作记录，SSI 看收入和资源，401(k)／IRA 另有规则；先分清问哪一项。', en: 'Retirement benefits follow your work record, SSI your income and resources, a 401(k) or IRA its own rules; know which one you mean.' },
    { zh: '通常需要 40 个工作积分；先在官方账号逐年核对工作收入，缺漏向 SSA 询问更正。', en: 'You usually need 40 work credits; check each year of earnings in your official account and ask SSA to correct gaps.' },
    { zh: '最早 62 岁领取；1960 年及以后出生者 67 岁为完全退休年龄，延后增额通常到 70 岁。', en: 'Benefits can start at 62; full retirement age is 67 if born 1960 or later; delayed increases usually stop at 70.' },
    { zh: '打 1-800-772-1213，可要求免费中文口译。', en: 'Call 1-800-772-1213 and ask for a free Chinese interpreter.' },
  ],
};
