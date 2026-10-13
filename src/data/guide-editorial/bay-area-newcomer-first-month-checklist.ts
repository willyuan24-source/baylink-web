import type { GuideEditorial } from './types';

// Facts from the article. CNT-GUIDES read SSA (immigrant-visa SSN cards: "If you don't receive your card within 3 weeks of
// being admitted…"; first-time online application, card in 5 to 10 business days), DMV new residents and Covered California
// (open enrollment Nov. 1 – Jan. 31; Mandarin 800-300-1533, Cantonese 800-339-8938) on 2026-10-12. BBL-05: SSN for newcomers.
export const newcomerFirstMonthEditorial: GuideEditorial = {
  slug: 'bay-area-newcomer-first-month-checklist',
  cover: {
    question: { zh: '刚到湾区，第一个月先办什么？', en: 'Just arrived? What comes first?' },
    title: { zh: '先安顿住和行，再办证件和医保', en: 'Housing and transport first, then papers and health cover' },
    answer: { zh: '社安卡入境 3 周没到，去 SSA', en: 'No SSN card 3 weeks after arrival? Go to SSA' },
    phone: { label: { zh: '社会保障局 SSA', en: 'Social Security Administration' }, number: '1-800-772-1213', tel: '+18007721213' },
    line: { zh: '住处 · 通勤 · 手机 · SSN · 驾照 · 医保', en: 'Housing · commute · phone · SSN · license · health cover' },
  },
  keyFacts: [
    { label: { zh: '社安号（移民签证）', en: 'SSN (immigrant visa)' }, value: { zh: 'DS-260 勾选后寄到美国地址；入境 3 周没到，带证明去 SSA', en: 'Requested on the DS-260, it is mailed to your U.S. address; nothing after 3 weeks? Take documents to SSA' }, source: 1 },
    { label: { zh: '社安号（其他人）', en: 'SSN (everyone else)' }, value: { zh: '网上申请，再到 SSA 交材料；批准后 5 到 10 个工作日寄卡', en: 'Apply online, then bring documents to SSA; the card comes 5 to 10 business days after approval' }, source: 2 },
    { label: { zh: '驾照与车', en: 'License and car' }, value: { zh: '外州驾照最多再开 10 天；外州车辆 20 天内登记', en: 'Out-of-state license for at most 10 more days; register the car within 20 days' }, source: 3 },
    { label: { zh: '医保报名', en: 'Health coverage' }, value: { zh: 'Covered California 11 月 1 日到 1 月 31 日；与 Medi-Cal 同一份申请', en: 'Covered California November 1 to January 31; one application with Medi-Cal' }, source: 4 },
    { label: { zh: '中文电话', en: 'Chinese phone lines' }, value: { zh: 'Covered California 国语 800-300-1533，粤语 800-339-8938', en: 'Covered California Mandarin 800-300-1533, Cantonese 800-339-8938' }, source: 5 },
  ],
  contacts: [
    { name: { zh: '社会保障局 SSA', en: 'Social Security Administration' }, number: '1-800-772-1213', tel: '+18007721213',
      languages: [{ zh: '中文口译', en: 'Chinese interpreter' }],
      note: { zh: '社安卡没收到、或要问申请材料时打；可要求中文口译。', en: 'Call about a card that has not arrived or about documents; ask for a Chinese interpreter.' }, source: 1 },
    { name: { zh: 'Covered California（国语）', en: 'Covered California (Mandarin)' }, number: '800-300-1533', tel: '+18003001533',
      note: { zh: '同一份申请也会看你是否符合 Medi-Cal。', en: 'The same application checks whether you qualify for Medi-Cal.' }, source: 5 },
    { name: { zh: 'Covered California（粤语）', en: 'Covered California (Cantonese)' }, number: '800-339-8938', tel: '+18003398938', source: 5 },
  ],
  slides: [
    { kind: 'checklist', kicker: { zh: '第一周', en: 'Week one' }, title: { zh: '先把住和行稳定下来', en: 'Settle where you sleep and how you move' },
      items: [
        { zh: '确认入住安排，别落地才发现拿不到钥匙', en: "Confirm your move-in so you don't land without keys" },
        { zh: '存好住处、学校或公司、超市、车站', en: 'Save home, school or work, a supermarket and the nearest station' },
        { zh: '下载地图和常用出行应用', en: 'Install maps and the transit apps you need' },
      ] },
    { kind: 'point', kicker: { zh: '社安号', en: 'Social Security number' }, title: { zh: '移民签证：入境 3 周看社安卡', en: 'Immigrant visa: watch for the card for 3 weeks' },
      body: { zh: 'DS-260 上勾选申请的，SSA 把卡寄到你在美国的地址。入境满 3 周还没收到，带年龄、身份和工作许可证明去最近的 SSA 办公室。', en: 'If you asked on the DS-260, SSA mails the card to your U.S. address. If it has not come 3 weeks after you were admitted, take proof of age, identity and work authorization to the nearest SSA office.' },
      phones: [{ label: { zh: 'SSA', en: 'SSA' }, number: '1-800-772-1213', tel: '+18007721213' }], source: 1 },
    { kind: 'compare', kicker: { zh: '驾照与车', en: 'License and car' }, title: { zh: '两个期限分开算', en: 'Two separate deadlines' },
      items: [
        { zh: '10 天：成为居民后，外州驾照最多再开这么久', en: '10 days: the most you may drive on an out-of-state license after becoming a resident' },
        { zh: '20 天：外州车辆办加州登记', en: '20 days: register an out-of-state car in California' },
      ], body: { zh: '首次申请驾照要预约到 DMV 考笔试；DMV 有中文驾驶手册和练习题。', en: 'A first license needs a DMV appointment for the knowledge test; DMV has the handbook and practice tests in Chinese.' }, source: 3 },
    { kind: 'point', kicker: { zh: '医保', en: 'Health coverage' }, title: { zh: '一份申请，两种可能', en: 'One application, two possible programs' },
      items: [
        { zh: 'Covered California：11 月 1 日到 1 月 31 日开放报名', en: 'Covered California: open enrollment November 1 to January 31' },
        { zh: '12 月 31 日前报名，1 月 1 日生效', en: 'Enroll by December 31 for coverage from January 1' },
        { zh: '其他时间：失去保险、结婚等变化后一般 60 天内', en: 'Other times: usually within 60 days of losing coverage, marrying or another big change' },
      ], source: 4 },
    { kind: 'contacts', kicker: { zh: '中文电话', en: 'Chinese phone lines' }, title: { zh: 'Covered California 中文专线', en: 'Covered California in Chinese' },
      phones: [
        { label: { zh: '国语', en: 'Mandarin' }, number: '800-300-1533', tel: '+18003001533' },
        { label: { zh: '粤语', en: 'Cantonese' }, number: '800-339-8938', tel: '+18003398938' },
      ], source: 5 },
  ],
  steps: [
    { zh: '第一周先确认入住、存好常去地点、装好地图和出行应用。', en: 'In week one, confirm move-in, save your usual places and install maps and transit apps.' },
    { zh: '先用一两周感受通勤，再决定长期住哪里；押金和申请费写进合同。', en: 'Try the commute for a week or two before choosing a long-term place; get the deposit and fees in the lease.' },
    { zh: '手机先能用、支付先顺手，日用品从基础买起。', en: 'Get the phone working and payments simple; buy the basics first.' },
    { zh: '移民签证入境 3 周没收到社安卡就去 SSA；外州驾照最多再开 10 天；医保 11 月 1 日起报名。', en: 'No SSN card 3 weeks after arriving on an immigrant visa? Go to SSA. Drive on an out-of-state license for at most 10 more days. Health enrollment opens November 1.' },
  ],
};
