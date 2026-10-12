import type { GuideEditorial } from './types';

// Facts from the article. CNT-GUIDES read the California DOJ tenant guidance, the California Courts deposit guide (21 days,
// $125 receipts, $12,500 small claims) and CRD (800-884-1684) on 2026-10-12; quotes in docs/source-reads-2026-10.md.
export const tenantRightsEditorial: GuideEditorial = {
  slug: 'california-tenant-deposit-rights-help-guide',
  cover: {
    question: { zh: '押金被扣、维修没人管？', en: 'Deposit withheld or repairs ignored?' },
    title: { zh: '先留证据，再找能处理的入口', en: 'Keep evidence, then find the right office' },
    answer: { zh: '押金：搬出后 21 天内退', en: 'Deposit back within 21 days of move-out' },
    line: { zh: '押金 · 维修 · 歧视 · 驱逐通知', en: 'Deposits · repairs · discrimination · eviction papers' },
  },
  keyFacts: [
    { label: { zh: '押金上限', en: 'Deposit limit' }, value: { zh: '2024 年 7 月 1 日后，多数房东最多收一个月房租', en: "After July 1, 2024, one month's rent for most landlords" }, source: 1 },
    { label: { zh: '退押金', en: 'Getting it back' }, value: { zh: '搬出后 21 天内退款并列明扣款；超过 $125 要附收据', en: 'Refund and itemized list within 21 days of move-out; receipts for deductions over $125' }, source: 3 },
    { label: { zh: '谈不拢', en: 'If you disagree' }, value: { zh: '先写信要求退还；小额法庭最多可诉 $12,500', en: 'Write a demand letter first; small claims court up to $12,500' }, source: 3 },
    { label: { zh: '住房歧视', en: 'Housing discrimination' }, value: { zh: '加州民权局 CRD 800-884-1684', en: 'Civil Rights Department (CRD) 800-884-1684' }, source: 2 },
    { label: { zh: '收到驱逐法院文件', en: 'Eviction court papers' }, value: { zh: '当天联系法律援助或法院自助中心', en: 'Contact legal aid or a court self-help center the same day' }, source: 4 },
  ],
  contacts: [
    { name: { zh: '加州民权局 CRD（住房歧视）', en: 'Civil Rights Department (housing discrimination)' }, number: '800-884-1684', tel: '+18008841684',
      note: { zh: '受保护身份的歧视、报复和合理便利；一般押金纠纷不归 CRD。', en: 'Discrimination, retaliation and reasonable accommodation; ordinary deposit disputes are not CRD matters.' }, source: 2 },
  ],
  slides: [
    { kind: 'point', kicker: { zh: '押金', en: 'Deposits' }, title: { zh: '上限、21 天和 $125', en: 'The cap, 21 days and $125' },
      items: [
        { zh: '多数房东：2024 年 7 月 1 日后最多一个月房租', en: "Most landlords: one month's rent after July 1, 2024" },
        { zh: '搬出后 21 天内退款，并附逐项扣款清单', en: 'Refund within 21 days of move-out, with an itemized list' },
        { zh: '扣款超过 $125：附发票或收据', en: 'Deductions over $125: invoices or receipts attached' },
        { zh: '正常损耗不能扣', en: 'Normal wear and tear cannot be deducted' },
      ], source: 3 },
    { kind: 'checklist', kicker: { zh: '谈不拢时', en: 'If you disagree' }, title: { zh: '两步要回押金', en: 'Two steps to get it back' },
      items: [
        { zh: '① 写信要求退还押金，自己留一份', en: '① Write a letter asking for the deposit; keep a copy' },
        { zh: '② 小额法庭起诉，租客最多可诉 $12,500', en: '② Sue in small claims court, up to $12,500 for a tenant' },
        { zh: '恶意扣押：最多再判两倍押金', en: 'Bad faith: up to twice the deposit in added damages' },
      ], source: 3 },
    { kind: 'checklist', kicker: { zh: '先留证据', en: 'Keep evidence' }, title: { zh: '这些要保存好', en: 'Keep these' },
      items: [
        { zh: '租约、押金收据', en: 'Lease and deposit receipt' },
        { zh: '入住和搬出时的照片', en: 'Move-in and move-out photos' },
        { zh: '钥匙交接日期和转寄地址', en: 'Key handover date and forwarding address' },
      ] },
    { kind: 'compare', kicker: { zh: '找对入口', en: 'The right office' }, title: { zh: '问题不同，入口不同', en: 'Different problems, different offices' },
      items: [
        { zh: '身份歧视、报复、合理便利：CRD', en: 'Discrimination, retaliation, reasonable accommodation: CRD' },
        { zh: '一般押金、维修、租金：当地租务机构、法院自助中心或法律援助', en: 'Ordinary deposit, repair or rent disputes: local rent office, court self-help or legal aid' },
      ], source: 2 },
    { kind: 'safety', kicker: { zh: '驱逐文件', en: 'Eviction papers' }, title: { zh: '收到法院文件，当天找帮助', en: 'Court papers? Get help the same day' },
      body: { zh: '驱逐程序推进很快，逾期不回应可能直接败诉。记下收到日期和文件上的期限。', en: 'Evictions move fast and missing a deadline can lose the case. Note the date you got the papers and every deadline on them.' }, source: 1 },
  ],
  steps: [
    { zh: '多数房东押金最多一个月房租；搬出后 21 天内退款并列明扣款，超过 $125 附收据。', en: "Most landlords may take at most one month's rent; within 21 days of move-out they refund it with an itemized list, with receipts over $125." },
    { zh: '先拍照、书面通知房东并留记录；没解决再打给当地 code enforcement。', en: 'Photograph it, tell the landlord in writing and keep records; then call local code enforcement.' },
    { zh: '身份歧视找 CRD 800-884-1684；一般押金或维修纠纷找当地租务机构或法律援助。', en: 'Discrimination goes to CRD at 800-884-1684; ordinary deposit or repair disputes to a local rent office or legal aid.' },
    { zh: '收到驱逐文件当天联系法律援助或法院自助中心，记下文件上的期限。', en: 'The day eviction papers arrive, contact legal aid or court self-help and note every deadline.' },
  ],
};
