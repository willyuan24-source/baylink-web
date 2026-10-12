import type { GuideEditorial } from './types';

// Facts from the article (read 2026-10-06): Medicare.gov, DHCS dental directory and benefit-change pages, NEMS and UCSF pages.
export const dentalEditorial: GuideEditorial = {
  slug: 'bay-area-dental-care-insurance-low-cost-guide',
  cover: {
    question: { zh: '要看牙，费用从哪来？', en: 'Need a dentist? Who pays?' },
    title: { zh: '看牙先分清牙科保障和一般医保', en: 'Check dental coverage apart from health insurance' },
    answer: { zh: 'Medi-Cal 牙科 1-800-322-6384', en: 'Medi-Cal Dental 1-800-322-6384' },
    phone: { label: { zh: 'Medi-Cal 牙科服务中心', en: 'Medi-Cal Dental Telephone Service Center' }, number: '1-800-322-6384', tel: '+18003226384' },
    line: { zh: '保险网络 · Medi-Cal Dental · 低费入口', en: 'Insurance network · Medi-Cal Dental · lower-cost options' },
  },
  keyFacts: [
    { label: { zh: '有 Medi-Cal', en: 'With Medi-Cal' }, value: { zh: '查 DHCS 牙医目录；找不到接新病人的牙医打 1-800-322-6384', en: "Use the DHCS dentist directory; if no one takes new patients, call 1-800-322-6384" }, source: 2 },
    { label: { zh: '只有 Original Medicare', en: 'Original Medicare only' }, value: { zh: '大多数常规洗牙、补牙、拔牙、假牙不由它支付', en: 'Most routine cleanings, fillings, extractions and dentures are not covered' }, source: 1 },
    { label: { zh: '福利变动', en: 'Benefit changes' }, value: { zh: '部分成人非急诊牙科变动延至 2027 年 7 月 1 日', en: 'Some adult non-emergency dental changes are delayed to July 1, 2027' }, source: 3 },
    { label: { zh: '低费路线', en: 'Lower-cost options' }, value: { zh: 'NEMS 按收入减费（不是免费诊所）；UCSF 学生诊所接收 Denti-Cal', en: 'NEMS sliding fee (not a free clinic); the UCSF student clinic accepts Denti-Cal' }, source: 6 },
  ],
  contacts: [
    { name: { zh: 'Medi-Cal 牙科服务中心', en: 'Medi-Cal Dental Telephone Service Center' }, number: '1-800-322-6384', tel: '+18003226384',
      note: { zh: '目录里找不到接收新病人的牙医时，打这个官方电话请求帮助。', en: 'Call this official line when the directory has no dentist taking new patients.' }, source: 2 },
  ],
  slides: [
    { kind: 'point', kicker: { zh: '先分清', en: 'First' }, title: { zh: '有医保，不等于牙科都能报', en: 'Health insurance is not dental coverage' },
      body: { zh: '大多数常规洗牙、补牙、拔牙、假牙与种植牙不由 Original Medicare 支付；按自己的牙科计划逐项问。', en: 'Original Medicare does not pay for most routine cleanings, fillings, extractions, dentures or implants; ask your dental plan item by item.' }, source: 1 },
    { kind: 'contacts', kicker: { zh: '有 Medi-Cal', en: 'With Medi-Cal' }, title: { zh: '先查官方牙医目录', en: 'Start with the official dentist directory' },
      body: { zh: '目录里的接诊信息仍要电话确认。', en: 'Phone the office to confirm it takes new patients.' },
      phones: [{ label: { zh: '找不到接新病人的牙医', en: 'No dentist taking new patients' }, number: '1-800-322-6384', tel: '+18003226384' }], source: 2 },
    { kind: 'point', kicker: { zh: '福利变动', en: 'Benefit changes' }, title: { zh: '看最新的专门通知', en: 'Read the latest notice' },
      body: { zh: '部分成人因移民身份受影响的非急诊牙科变动已延至 2027 年 7 月 1 日；这不是所有成人牙科都取消。', en: 'Some non-emergency dental changes for adults affected by immigration status are delayed to July 1, 2027; adult dental care is not cancelled for everyone.' }, source: 3 },
    { kind: 'compare', kicker: { zh: '低费路线', en: 'Lower-cost options' }, title: { zh: '各有规则，先问清', en: 'Each has its own rules' },
      items: [
        { zh: 'NEMS：按家庭人数和收入减费，每年重新登记；不是免费诊所', en: 'NEMS: sliding fee by household size and income, renewed yearly; not a free clinic' },
        { zh: 'UCSF Parnassus 学生诊所：接收 Denti-Cal，耗时更长、要多次预约', en: 'UCSF Parnassus student clinic: accepts Denti-Cal; slower, several visits' },
      ], source: 6 },
    { kind: 'checklist', kicker: { zh: '预约前', en: 'Before you book' }, title: { zh: '先问这三件事', en: 'Ask these first' },
      items: [
        { zh: '牙医是否在你的网络内、是否接收新病人', en: 'Is the dentist in your network and taking new patients?' },
        { zh: '首次检查费和书面治疗计划', en: 'The first-visit fee and a written treatment plan' },
        { zh: '能否安排普通话、粤语或口译', en: 'Mandarin, Cantonese or an interpreter' },
      ] },
  ],
  steps: [
    { zh: '分别问保险计划和诊所：牙医是否在你的网络、是否接收新病人。', en: 'Ask both the plan and the clinic whether the dentist is in your network and taking new patients.' },
    { zh: '有 Medi-Cal 先查 DHCS 牙医目录；找不到接新病人的牙医，打 1-800-322-6384。', en: 'With Medi-Cal, use the DHCS directory; if no one takes new patients, call 1-800-322-6384.' },
    { zh: '费用吃紧可问 NEMS 按收入减费，或 UCSF 学生诊所；两者规则不同。', en: 'If cost is a worry, ask NEMS about its sliding fee or try the UCSF student clinic; their rules differ.' },
    { zh: '先要首次检查费和书面治疗计划，再比较保险支付和自付。', en: 'Get the first-visit fee and a written treatment plan before comparing what insurance pays.' },
  ],
};
