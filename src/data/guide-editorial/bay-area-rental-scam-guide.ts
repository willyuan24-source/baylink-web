import type { GuideEditorial } from './types';

// Facts from the article: BAYLINK's viewing and payment checks plus the California DOJ deposit cap (read 2026-10-12, "After July
// 1, 2024, for most landlords, the security deposit is limited to one month's rent"; ledger docs/source-reads-2026-10.md).
export const rentalScamEditorial: GuideEditorial = {
  slug: 'bay-area-rental-scam-guide',
  cover: {
    question: { zh: '房子好便宜，对方催你先转钱？', en: 'A cheap place and pressure to pay first?' },
    title: { zh: '没看房、没核实身份，先别转钱', en: "Don't pay before you see it and check who you're dealing with" },
    answer: { zh: '押金多数最多一个月房租', en: "Deposit: usually at most one month's rent" },
    line: { zh: '看房 · 核实身份 · 书面信息 · 再付款', en: 'View · verify · get it in writing · then pay' },
  },
  keyFacts: [
    { label: { zh: '正常顺序', en: 'The normal order' }, value: { zh: '先看房，再核实身份和书面信息，最后才谈付款', en: 'View first, verify identity and get it in writing, then talk about money' } },
    { label: { zh: '押金上限', en: 'Deposit cap' }, value: { zh: '2024 年 7 月 1 日后，多数房东最多一个月房租', en: "After July 1, 2024, one month's rent for most landlords" }, source: 3 },
    { label: { zh: '先别转', en: "Don't send" }, value: { zh: 'Zelle、Cash App、Venmo 等难追回的付款', en: 'Zelle, Cash App, Venmo or other hard-to-recover payments' } },
    { label: { zh: '直接放弃', en: 'Walk away' }, value: { zh: '拒绝实时看房、先要全额押金、合同迟迟不给', en: 'No live viewing, full deposit up front, no lease in sight' } },
  ],
  slides: [
    { kind: 'checklist', kicker: { zh: '看房前', en: 'Before viewing' }, title: { zh: '先核对这几件事', en: 'Check these first' },
      items: [
        { zh: '地址在地图上真的是这栋房子', en: 'The address is really this building on the map' },
        { zh: '租金比同区便宜很多，先问原因', en: 'Much cheaper than the area? Ask why' },
        { zh: '对方是房东、物业、主租人还是室友', en: 'Landlord, manager, master tenant or roommate?' },
        { zh: '不能到场就要实时视频看房', en: "Can't go in person? Ask for a live video tour" },
      ] },
    { kind: 'point', kicker: { zh: '转账前', en: 'Before you pay' }, title: { zh: '先问清这笔钱是什么', en: 'Know what the money is for' },
      items: [
        { zh: '申请费、holding deposit、押金，还是第一月房租', en: "Application fee, holding deposit, security deposit or first month's rent" },
        { zh: '收款人和出租人是同一人', en: 'The payee is the same person as the landlord' },
        { zh: '没租成时退不退、怎么退，要书面说明', en: "In writing: whether and how it's refunded if it falls through" },
      ] },
    { kind: 'point', kicker: { zh: '押金', en: 'Deposits' }, title: { zh: '多数房东最多一个月房租', en: "Most landlords: one month's rent at most" },
      body: { zh: '加州司法部写明：2024 年 7 月 1 日以后，多数房东的押金最多一个月房租。对方要两三个月押金，先问清依据；搬出后 21 天内要退押金并列明扣款。', en: "The Attorney General says that after July 1, 2024 most landlords may take at most one month's rent. Asked for two or three months? Ask why. Within 21 days of move-out the deposit comes back with an itemized list." }, source: 3 },
    { kind: 'safety', kicker: { zh: '直接放弃', en: 'Walk away' }, title: { zh: '这些信号出现就停', en: 'Stop when you see these' },
      items: [
        { zh: '拒绝实时看房，只发照片', en: 'No live viewing, photos only' },
        { zh: '一上来要全额押金或大额订金', en: 'Full deposit or a big hold fee up front' },
        { zh: '价格特别低，解释含糊', en: 'A very low price with vague reasons' },
        { zh: '合同和付款说明迟迟不给', en: 'No lease or payment terms, only "pay first"' },
      ] },
  ],
  steps: [
    { zh: '正常顺序：先看房，再核实身份和书面信息，最后才付款。', en: 'The normal order: view, verify and get it in writing, then pay.' },
    { zh: '核对地址、租金是否合理、对方身份；不能到场就实时视频看房。', en: "Check the address, whether the rent makes sense and who they are; can't go? Ask for a live video tour." },
    { zh: '没看房、没核实身份前别转难追回的付款；多数房东押金最多一个月房租。', en: "Don't send hard-to-recover payments before viewing and verifying; most landlords may take at most one month's rent as deposit." },
    { zh: '费用、租期、维修、转租和搬出要求写进合同再签字。', en: 'Get costs, term, repairs, subletting and move-out rules into the lease before signing.' },
  ],
};
