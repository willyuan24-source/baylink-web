import type { GuideEditorial } from './types';

// Facts from the article (checked 2026-10-05): IRS VITA/TCE and FTB online filing pages.
export const freeTaxHelpEditorial: GuideEditorial = {
  slug: 'bay-area-free-tax-help-vita-calfile-guide',
  cover: {
    question: { zh: '报税不想多花钱？', en: 'Want free help with your taxes?' },
    title: { zh: '先找 IRS 的免费志愿报税点', en: "Start with the IRS's free volunteer sites" },
    answer: { zh: 'VITA／TCE 800-906-9887', en: 'VITA / TCE 800-906-9887' },
    phone: { label: { zh: 'IRS VITA／TCE 查询', en: 'IRS VITA / TCE line' }, number: '800-906-9887', tel: '+18009069887' },
    line: { zh: 'VITA · TCE · CalFile', en: 'VITA · TCE · CalFile' },
  },
  keyFacts: [
    { label: { zh: '找报税点', en: 'Find a site' }, value: { zh: '用 IRS 的 VITA／TCE 查询，也可拨打 800-906-9887', en: "Use the IRS VITA / TCE locator or call 800-906-9887" }, source: 1 },
    { label: { zh: 'TCE', en: 'TCE' }, value: { zh: '特别面向 60 岁及以上人士的退休相关税务问题', en: 'Aimed at people 60 and older with retirement tax questions' }, source: 1 },
    { label: { zh: '加州自己申报', en: 'Filing California yourself' }, value: { zh: 'FTB 列出 CalFile 免费加州申报；联邦免费不等于州也免费', en: 'FTB lists CalFile, free for California; a free federal return does not make the state one free' }, source: 2 },
    { label: { zh: '预约时说明', en: 'When you book' }, value: { zh: '税务年份、收入类型、联邦和加州申报、需要的语言', en: 'Tax year, income types, federal and California returns, your language' } },
  ],
  contacts: [
    { name: { zh: 'IRS 免费报税帮助（VITA／TCE）', en: 'IRS free tax help (VITA / TCE)' }, number: '800-906-9887', tel: '+18009069887',
      note: { zh: '确认开放日期、是否预约、可处理的表格和资格。', en: 'Confirm open dates, appointments, the forms they handle and eligibility.' }, source: 1 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '两种志愿服务', en: 'Two volunteer programs' }, title: { zh: 'VITA 与 TCE', en: 'VITA and TCE' },
      items: [
        { zh: 'VITA：需要帮助的纳税人，包括英语能力有限者', en: 'VITA: taxpayers who need help, including limited-English speakers' },
        { zh: 'TCE：60 岁及以上人士的退休相关税务问题', en: 'TCE: retirement tax questions for people 60 and older' },
      ], body: { zh: '站点服务范围各不相同，不能凭一个全国收入数字保证接单。', en: 'Each site differs; no single income figure guarantees a site will take your return.' }, source: 1 },
    { kind: 'checklist', kicker: { zh: '预约时', en: 'When you book' }, title: { zh: '先说清这些', en: 'Say these first' },
      items: [
        { zh: '税务年份和收入类型', en: 'Tax year and income types' },
        { zh: '联邦和加州申报需求', en: 'Federal and California returns' },
        { zh: '需要的语言', en: 'The language you need' },
      ] },
    { kind: 'point', kicker: { zh: '自己申报', en: 'Filing yourself' }, title: { zh: '联邦和加州分开核对', en: 'Check federal and California separately' },
      body: { zh: 'FTB 的官方页面列出 CalFile 免费加州申报；“联邦免费”的广告不等于两份都免费。', en: "FTB's page lists CalFile for a free California return; a free federal offer does not cover both." }, source: 2 },
  ],
  steps: [
    { zh: '联邦免费和加州免费分开核对；加州可从 FTB 页面进入 CalFile。', en: 'Check free federal and free California filing separately; reach CalFile from the FTB page.' },
  ],
};
