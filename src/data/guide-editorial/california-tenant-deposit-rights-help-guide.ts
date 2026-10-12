import type { GuideEditorial } from './types';

// Facts from the article (checked 2026-10-05): California DOJ and CRD guidance, California Courts and State Bar entry points.
export const tenantRightsEditorial: GuideEditorial = {
  slug: 'california-tenant-deposit-rights-help-guide',
  cover: {
    question: { zh: '押金被扣、维修没人管？', en: 'Deposit withheld or repairs ignored?' },
    title: { zh: '先留证据，再找能处理的入口', en: 'Keep evidence, then find the right office' },
    answer: { zh: '押金明细：搬出后 21 天内', en: 'Deposit statement: within 21 days of move-out' },
    line: { zh: '押金 · 维修 · 歧视 · 驱逐通知', en: 'Deposits · repairs · discrimination · eviction papers' },
  },
  keyFacts: [
    { label: { zh: '押金上限', en: 'Deposit limit' }, value: { zh: '多数房东：2024 年 7 月 1 日后为一个月租金，有例外', en: "For most landlords, one month's rent after July 1, 2024, with exceptions" }, source: 1 },
    { label: { zh: '退押金', en: 'Getting it back' }, value: { zh: '搬出后一般 21 天内交扣款明细并退还余款', en: 'An itemized statement and the balance usually within 21 days of moving out' }, source: 1 },
    { label: { zh: '维修', en: 'Repairs' }, value: { zh: '先拍照并书面告知房东；不凭论坛建议停付租金', en: "Photograph it and tell the landlord in writing; don't withhold rent on forum advice" } },
    { label: { zh: '收到驱逐法院文件', en: 'Eviction court papers' }, value: { zh: '当天联系法律援助或法院自助中心', en: 'Contact legal aid or a court self-help center the same day' }, source: 4 },
  ],
  slides: [
    { kind: 'point', kicker: { zh: '押金', en: 'Deposits' }, title: { zh: '上限和 21 天', en: 'The limit and 21 days' },
      items: [
        { zh: '多数房东：2024 年 7 月 1 日后上限一个月租金，有例外', en: "Most landlords: one month's rent after July 1, 2024, with exceptions" },
        { zh: '搬出后一般 21 天内给扣款明细并退余款', en: 'Statement and balance usually within 21 days of move-out' },
        { zh: '正常损耗不能当作租客损坏收费', en: 'Normal wear and tear is not tenant damage' },
      ], source: 1 },
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
      body: { zh: '驱逐程序推进很快，拖延可能自动败诉。记下收到日期和文件上的期限。', en: 'Evictions move fast and delay can mean losing by default. Note the date you got the papers and every deadline on them.' }, source: 1 },
  ],
  steps: [
    { zh: '押金上限多数为一个月租金（有例外）；搬出后一般 21 天内交扣款明细。', en: "The deposit limit is usually one month's rent (with exceptions); the statement usually comes within 21 days of move-out." },
    { zh: '先拍照、书面通知房东并留记录；未解决再问当地 code enforcement。', en: 'Photograph it, notify the landlord in writing and keep records; then ask local code enforcement.' },
    { zh: '身份歧视找 CRD；一般押金或维修纠纷找当地租务机构或法律援助。', en: 'Discrimination goes to CRD; ordinary deposit or repair disputes to a local rent office or legal aid.' },
    { zh: '收到驱逐文件当天联系法律援助或法院自助中心，记下文件上的期限。', en: 'The day eviction papers arrive, contact legal aid or court self-help and note every deadline.' },
  ],
};
