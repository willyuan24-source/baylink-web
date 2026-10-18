import type { GuideEditorial } from './types';

// Facts from the article (CNT-YEAREND, pages read 2026-10-17; Marin, Napa and Santa Clara County pages from the GPT editor review
// of 2026-10-16). Source numbers: 1 DMV, 2 SSA holidays, 5 BART, 6 Muni, 8 Caltrain, 11 SFPL. 日常办事, 2026/11/26–2027/1/1.
export const holidayHoursEditorial: GuideEditorial = {
  slug: 'bay-area-holiday-hours-thanksgiving-new-year-2026',
  cover: {
    question: { zh: '感恩节到元旦，哪天能办事、怎么坐车？', en: 'Thanksgiving to New Year’s: when can you get things done, and how do you get around?' },
    title: { zh: '六个假日，逐个机构看开不开门', en: 'Six holidays, agency by agency' },
    answer: { zh: 'DMV 11/26、11/27、12/25、1/1 全天关门', en: 'DMV closed Nov 26, Nov 27, Dec 25 and Jan 1' },
    line: { zh: '每一行写明依据：日期表 · 常设规则 · 县政府 · 未公布', en: 'Every line names its basis: dated list · standing rule · county · not published' },
  },
  keyFacts: [
    { label: { zh: 'DMV', en: 'DMV' }, value: { zh: '11/26、11/27、12/25 和 2027 年 1/1 全天关门；12/24、12/31 未公布', en: 'Closed all day Nov 26, Nov 27, Dec 25 and Jan 1, 2027; Dec 24 and Dec 31 not published' }, source: 1 },
    { label: { zh: '社安局 SSA', en: 'Social Security' }, value: { zh: '11/26、12/25 办公室关门；11/27、12/24、12/31 不在假日表上', en: 'Offices closed Nov 26 and Dec 25; Nov 27, Dec 24 and Dec 31 are not on the holiday list' }, source: 2 },
    { label: { zh: 'BART', en: 'BART' }, value: { zh: '11/26、12/25 和 2027 年 1/1 按周日班表，8:00 到午夜', en: 'Sunday service, 8 a.m. to midnight, on Nov 26, Dec 25 and Jan 1, 2027' }, source: 5 },
    { label: { zh: 'Muni', en: 'Muni' }, value: { zh: '11/26 和 1/1 周末班表（周日安排），12/25 周末班表（周六安排），11/27 平日非上课日班表', en: 'Weekend schedule on Nov 26 and Jan 1 (Sunday operators) and Dec 25 (Saturday operators); weekday non-school schedule Nov 27' }, source: 6 },
    { label: { zh: 'SFPL 图书馆', en: 'SF Public Library' }, value: { zh: '11/26、11/27、12/25 和 1/1 闭馆；12/24、12/31 17:00 关门', en: 'Closed Nov 26, Nov 27, Dec 25 and Jan 1; closes at 5 p.m. on Dec 24 and Dec 31' }, source: 11 },
  ],
  slides: [
    { kind: 'checklist', kicker: { zh: '怎么读', en: 'How to read it' }, title: { zh: '每一行后面的方括号', en: 'The brackets after each line' },
      items: [
        { zh: '【日期表】机构自己写明这一天', en: '[Dated list] the agency names this day itself' },
        { zh: '【常设规则】长期规则对上当年的日期', en: '[Standing rule] a long-standing rule matched to this year' },
        { zh: '【县政府公告】【县假日表】县政府层面，不是逐个福利窗口', en: '[County notice] [County holiday list] county-wide, not window by window' },
        { zh: '【未公布】还没有官方说法', en: '[Not published] no official word yet' },
      ] },
    { kind: 'compare', kicker: { zh: '办事', en: 'Offices' }, title: { zh: 'DMV 和社安局', en: 'DMV and Social Security' },
      items: [
        { zh: 'DMV：11/26、11/27、12/25、1/1 关门', en: 'DMV: closed Nov 26, Nov 27, Dec 25, Jan 1' },
        { zh: 'SSA：11/26、12/25 关门；1/1 按联邦假日规则关门', en: 'SSA: closed Nov 26 and Dec 25; Jan 1 under its federal-holiday rule' },
        { zh: '12/24、12/31 两家都没公布', en: 'Dec 24 and Dec 31: neither has published anything' },
      ] },
    { kind: 'checklist', kicker: { zh: '县福利窗口', en: 'County benefits offices' }, title: { zh: '县政府放假，不等于每个窗口都关', en: 'A county holiday is not every window closing' },
      items: [
        { zh: 'Santa Clara：申请办公室县假日关门，11/26、11/27、12/25、1/1', en: 'Santa Clara: benefits offices close on county holidays: Nov 26, Nov 27, Dec 25, Jan 1' },
        { zh: 'Contra Costa EHSD：六天都未公布', en: 'Contra Costa EHSD: none of the six days published' },
        { zh: 'Sonoma：“多数县办公室关门”，不是全部', en: 'Sonoma: “most county offices closed”, not all' },
      ] },
    { kind: 'compare', kicker: { zh: '图书馆', en: 'Libraries' }, title: { zh: '跨年夜几点关门', en: 'When libraries close on New Year’s Eve' },
      items: [
        { zh: 'SFPL、SCCLD、San Mateo、Alameda County、Contra Costa：17:00', en: 'SFPL, SCCLD, San Mateo, Alameda County, Contra Costa: 5 p.m.' },
        { zh: 'Oakland：17:30；Berkeley：18:00', en: 'Oakland: 5:30 p.m.; Berkeley: 6 p.m.' },
        { zh: 'San José：2026 年跨年夜未公布', en: 'San José: New Year’s Eve 2026 not published' },
      ] },
    { kind: 'compare', kicker: { zh: '公交', en: 'Transit' }, title: { zh: '假日按哪种班表', en: 'Which schedule on the holidays' },
      items: [
        { zh: 'BART：11/26、12/25、1/1 周日班表', en: 'BART: Sunday service Nov 26, Dec 25, Jan 1' },
        { zh: 'Caltrain：11/27、12/24 调整班表，节前几周公布', en: 'Caltrain: modified schedules Nov 27 and Dec 24, posted a few weeks ahead' },
        { zh: 'AC Transit、VTA：感恩节、圣诞、元旦按周日班表', en: 'AC Transit, VTA: Sunday schedules on Thanksgiving, Christmas and New Year’s Day' },
        { zh: 'Muni 跨年夜：2026 年是否免费、当晚班次都未公布', en: 'Muni on New Year’s Eve: free rides and that night’s service in 2026 not published' },
      ] },
  ],
  steps: [
    { zh: '县放假、冬休“多数服务”关门，都不是每个窗口关门；图书馆闭馆说的是分馆；跨年夜加班车看当年公告。', en: 'A county holiday or a winter closure of “most services” is not every window; library closures are about branches; New Year’s Eve extra service needs that year’s notice.' },
    { zh: 'DMV 11/26、11/27、12/25、1/1 关门；社安局 11/26、12/25 关门，1/1 按联邦假日规则关门；12/24、12/31 两家都未公布。', en: 'DMV closes Nov 26, Nov 27, Dec 25 and Jan 1; Social Security closes Nov 26 and Dec 25, and Jan 1 under its federal-holiday rule; neither has published Dec 24 or Dec 31.' },
    { zh: '九个县里，Santa Clara 写明福利申请办公室县假日关门，旧金山 1460 Mission 中心写明市假日不开；其他县多是县政府层面的公告或放假表。', en: 'Of the nine counties, Santa Clara says its benefits offices close on county holidays and San Francisco’s 1460 Mission center says it closes on City holidays; the others mostly have county-wide notices or holiday lists.' },
    { zh: '八个图书馆系统 11/26、12/25 都闭馆；跨年夜多数 17:00 关门，Oakland 17:30、Berkeley 18:00。', en: 'All eight library systems close Nov 26 and Dec 25; on New Year’s Eve most close at 5 p.m., Oakland at 5:30 and Berkeley at 6.' },
    { zh: 'BART、AC Transit、VTA 在感恩节、圣诞、元旦按周日班表；Caltrain 11/27、12/24 是调整班表。', en: 'BART, AC Transit and VTA run Sunday schedules on Thanksgiving, Christmas and New Year’s Day; Caltrain runs modified schedules Nov 27 and Dec 24.' },
    { zh: '出门前再看临时关闭和当天车次。', en: 'Before you go, check for closures and that day’s trips.' },
  ],
};
