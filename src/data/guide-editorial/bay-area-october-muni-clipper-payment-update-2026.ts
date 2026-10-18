import type { GuideEditorial } from './types';

// Facts from the article (fares checked 2026-09-23 against SFMTA, Clipper and MTC pages in its sources). The 出行 topic pillar,
// also on the 长辈与家属 hub: seniors need the discount Clipper card, a tapped bank card pays the adult fare.
// CNT-YEAREND (2026-10-17): the three January 2027 dates (MuniMobile and Lifeline pages, the fare table effective 1/4/2027).
export const muniClipperEditorial: GuideEditorial = {
  slug: 'bay-area-october-muni-clipper-payment-update-2026',
  cover: {
    question: { zh: '坐 Muni 怎么付钱？', en: 'How do I pay on Muni now?' },
    title: { zh: '单程票不在 MuniMobile 卖了，先选对卡', en: 'MuniMobile no longer sells single rides: pick the right card' },
    answer: { zh: '长者要用优惠 Clipper 卡', en: 'Seniors: use a discount Clipper card' },
    line: { zh: '银行卡感应 · Clipper · 两小时换乘', en: 'Tap a bank card · Clipper · two-hour transfers' },
  },
  keyFacts: [
    { label: { zh: '已经变了', en: 'What changed' }, value: { zh: '9 月 1 日起 MuniMobile 不再卖单程票；日票等仍在', en: 'Since September 1, MuniMobile sells no single rides; day passes remain' }, source: 1 },
    { label: { zh: '普通成人', en: 'Adults' }, value: { zh: '感应银行卡、手机钱包或 Clipper 都可以', en: 'A contactless bank card, a phone wallet or Clipper' }, source: 2 },
    { label: { zh: '长者、青年', en: 'Seniors and youth' }, value: { zh: '要用对应的优惠 Clipper；直接拍银行卡按成人票', en: 'Use the matching discount Clipper; a tapped bank card pays the adult fare' }, source: 4 },
    { label: { zh: '换乘', en: 'Transfers' }, value: { zh: '两小时跨机构换乘，最高优惠 $2.85', en: 'Two-hour transfers between agencies, up to $2.85 off' }, source: 3 },
    { label: { zh: '2027 年 1 月', en: 'January 2027' }, value: { zh: '1 月 1 日 Lifeline 并入 Clipper START；1 月 3 日 App 停卖一日票', en: 'January 1: Lifeline moves to Clipper START; January 3: the app stops selling day passes' }, source: 1 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '按乘客选', en: 'By rider' }, title: { zh: '谁用什么付款', en: 'Who pays with what' },
      items: [
        { zh: '普通成人：感应银行卡、手机钱包或 Clipper', en: 'Adults: contactless bank card, phone wallet or Clipper' },
        { zh: '长者、青年、Clipper Access、START：对应的优惠 Clipper', en: 'Seniors, youth, Clipper Access, START: the matching discount Clipper' },
        { zh: '多人同行：每人一张卡或一个设备', en: 'Groups: one card or device per rider' },
      ], source: 4 },
    { kind: 'point', kicker: { zh: '换乘', en: 'Transfers' }, title: { zh: '两小时内换乘有优惠', en: 'A discount within two hours' },
      body: { zh: '新一代 Clipper 和感应银行卡都可参与，最高优惠 $2.85；不是每次固定返还，也不是整天免费。旧卡先查升级状态。', en: 'New Clipper and contactless bank cards both count, up to $2.85 off; not a fixed refund every time, and not free all day. Check whether an old card has been upgraded.' }, source: 3 },
    { kind: 'compare', kicker: { zh: '1 月 4 日起', en: 'From January 4' }, title: { zh: '2027 年 Muni 新票价', en: 'New Muni fares in 2027' },
      items: [
        { zh: '成人单程（Clipper）：$2.85 → $3.00；现金仍 $3.00', en: 'Adult single ride (Clipper): $2.85 → $3.00; cash stays $3.00' },
        { zh: '长者、残障、Clipper START 单程：$1.40 → $1.50', en: 'Senior, disabled, Clipper START single ride: $1.40 → $1.50' },
        { zh: '成人 M 月票 $86 → $90；长者／Lifeline 月票 $43 → $45', en: 'Adult M pass $86 → $90; senior / Lifeline pass $43 → $45' },
        { zh: '缆车单程 $9 → $12；新 Cable Car Plus 一日票 $18；Visitor Passport 停用', en: 'Cable car single $9 → $12; new $18 Cable Car Plus day pass; Visitor Passports end' },
      ], source: 6 },
    { kind: 'checklist', kicker: { zh: '出发前', en: 'Before you go' }, title: { zh: '只做三件事', en: 'Just three things' },
      items: [
        { zh: '给每位同行者选定付款卡', en: 'Pick a payment card for each rider' },
        { zh: '去程和返程分别查好', en: 'Plan the trip out and back separately' },
        { zh: 'Muni-only Day Pass 不含缆车', en: 'The Muni-only Day Pass does not cover cable cars' },
      ] },
  ],
  steps: [
    { zh: '长者、青年要用对应的优惠 Clipper；直接拍银行卡按成人票收费。', en: 'Seniors and youth need the matching discount Clipper; a tapped bank card pays the adult fare.' },
    { zh: '两小时内跨机构换乘最高优惠 $2.85，旧卡先查升级状态。', en: 'Transfers within two hours get up to $2.85 off; check whether an old card has been upgraded.' },
    { zh: '三个日期分开记：1 月 1 日 Lifeline 并入 Clipper START，1 月 3 日 App 停卖一日票，1 月 4 日新票价生效。', en: 'Keep three dates apart: Lifeline moves to Clipper START on January 1, the app stops selling day passes on January 3, new fares start January 4.' },
  ],
};
