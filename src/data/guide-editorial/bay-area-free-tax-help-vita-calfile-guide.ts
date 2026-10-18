import type { GuideEditorial } from './types';

// Facts from the article. CNT-GUIDES read the IRS VITA/TCE page and the FTB CalFile page on 2026-10-12 (ledger:
// docs/source-reads-2026-10.md): the "about $70,244 or less" line, AARP Tax-Aide 888-227-7669 and "CalFile is completely free".
// CNT-YEAREND (2026-10-17): "does not set a program-wide income limit", and the 2027 filing-season dates (none announced yet).
export const freeTaxHelpEditorial: GuideEditorial = {
  slug: 'bay-area-free-tax-help-vita-calfile-guide',
  cover: {
    question: { zh: '报税不想多花钱？', en: 'Want free help with your taxes?' },
    title: { zh: '先找 IRS 的免费志愿报税点', en: "Start with the IRS's free volunteer sites" },
    answer: { zh: 'VITA／TCE 800-906-9887', en: 'VITA / TCE 800-906-9887' },
    phone: { label: { zh: 'IRS VITA／TCE 查询', en: 'IRS VITA / TCE line' }, number: '800-906-9887', tel: '+18009069887' },
    line: { zh: '常见服务收入约 $70,244 以下的人，没有统一收入上限', en: 'Commonly for incomes of about $70,244 or less; no program-wide limit' },
  },
  keyFacts: [
    { label: { zh: '谁可以用 VITA', en: 'Who VITA serves' }, value: { zh: '常见：年收入约 $70,244 以下、残障人士、英语不流利者；IRS 不设统一收入上限', en: 'Commonly: about $70,244 or less a year, people with disabilities, limited-English taxpayers; no program-wide income limit' }, source: 1 },
    { label: { zh: '找报税点', en: 'Find a site' }, value: { zh: 'IRS 查询，或拨 800-906-9887', en: 'IRS locator, or call 800-906-9887' }, source: 1 },
    { label: { zh: '60 岁以上', en: 'Age 60 and older' }, value: { zh: 'TCE；AARP Tax-Aide 888-227-7669（1–4 月）', en: 'TCE; AARP Tax-Aide 888-227-7669 (January–April)' }, source: 1 },
    { label: { zh: '加州税表', en: 'California return' }, value: { zh: 'FTB 的 CalFile 完全免费', en: "FTB's CalFile is completely free" }, source: 3 },
  ],
  contacts: [
    { name: { zh: 'IRS 免费报税帮助（VITA／TCE）', en: 'IRS free tax help (VITA / TCE)' }, number: '800-906-9887', tel: '+18009069887',
      note: { zh: '查最近的站点；预约时说清税务年份、收入类型和语言。', en: 'Find the nearest site; when you book, give the tax year, income types and language.' }, source: 1 },
    { name: { zh: 'AARP Tax-Aide（多数 TCE 站点）', en: 'AARP Tax-Aide (most TCE sites)' }, number: '888-227-7669', tel: '+18882277669',
      note: { zh: '每年 1 月到 4 月可查站点。', en: 'Site search runs January to April.' }, source: 1 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '两种志愿服务', en: 'Two volunteer programs' }, title: { zh: 'VITA 与 TCE', en: 'VITA and TCE' },
      items: [
        { zh: 'VITA：常见对象是年收入约 $70,244 以下、残障人士、英语不流利者；各站可自定收入范围', en: 'VITA: commonly about $70,244 or less, people with disabilities, limited-English taxpayers; each site may set its own income range' },
        { zh: 'TCE：60 岁及以上，退休金和退休相关税务', en: 'TCE: age 60 and older, pensions and retirement taxes' },
      ], body: { zh: '都免费，由 IRS 认证的志愿者帮你报税。', en: 'Both are free, with IRS-certified volunteers.' }, source: 1 },
    { kind: 'contacts', kicker: { zh: '找报税点', en: 'Find a site' }, title: { zh: '两个电话，存好', en: 'Two numbers to keep' },
      phones: [
        { label: { zh: 'IRS VITA／TCE 查询', en: 'IRS VITA / TCE line' }, number: '800-906-9887', tel: '+18009069887' },
        { label: { zh: 'AARP Tax-Aide（1–4 月）', en: 'AARP Tax-Aide (January–April)' }, number: '888-227-7669', tel: '+18882277669' },
      ], source: 1 },
    { kind: 'checklist', kicker: { zh: '预约时', en: 'When you book' }, title: { zh: '先说清这些', en: 'Say these first' },
      items: [
        { zh: '税务年份和收入类型', en: 'Tax year and income types' },
        { zh: '联邦、加州，还是两份都要', en: 'Federal, California or both' },
        { zh: '需要的语言', en: 'The language you need' },
      ] },
    { kind: 'checklist', kicker: { zh: '2027 年报税季', en: 'The 2027 filing season' }, title: { zh: '几个日期分开看', en: 'One date at a time' },
      items: [
        { zh: 'IRS 开放日：还没公布（上一季是 2026 年 1 月 26 日）', en: 'IRS opening day: not announced (last season it was January 26, 2026)' },
        { zh: 'FTB 电子报税：2027 年的日期还没列出', en: 'FTB e-file: 2027 dates not listed yet' },
        { zh: 'VITA 站点：多数 2 月到 5 月开，各站自己公布', en: 'VITA sites: most open February through May; each posts its own dates' },
      ] },
    { kind: 'point', kicker: { zh: '自己报加州税', en: 'Filing California yourself' }, title: { zh: 'CalFile 完全免费', en: 'CalFile is completely free' },
      body: { zh: '直接向加州税务局在线申报，目前接受 2023、2024 和 2025 税务年度；联邦税另在 IRS 申报。', en: 'E-file directly with the Franchise Tax Board; it now accepts tax years 2023, 2024 and 2025. File the federal return separately with the IRS.' }, source: 3 },
  ],
  steps: [
    { zh: '用 IRS 查询或拨 800-906-9887 找站点；长者也可拨 AARP Tax-Aide 888-227-7669。', en: 'Use the IRS locator or call 800-906-9887; older adults can also call AARP Tax-Aide at 888-227-7669.' },
    { zh: '加州税表用 FTB 的 CalFile 免费在线申报，联邦税另报。', en: "File the California return free with FTB's CalFile; file the federal return separately." },
    { zh: '2027 年报税季：IRS 和 FTB 的开放日都还没公布；CalFile 目前收 2023、2024 和 2025 税务年度，VITA 各站自己公布开门日。', en: 'The 2027 filing season: neither the IRS nor FTB has announced an opening date; CalFile now takes tax years 2023, 2024 and 2025, and each VITA site posts its own opening day.' },
  ],
};
