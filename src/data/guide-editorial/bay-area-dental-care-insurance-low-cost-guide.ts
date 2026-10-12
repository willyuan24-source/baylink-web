import type { GuideEditorial } from './types';

// Facts from the article. CNT-GUIDES read Medicare.gov, the DHCS dentist directory (new-patient filter, 1-800-322-6384, Mon-Fri
// 8-5), the DHCS benefit-change page, NEMS and UCSF Parnassus (415-502-5800) in a browser on 2026-10-12.
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
    { label: { zh: '只有 Original Medicare', en: 'Original Medicare only' }, value: { zh: '多数情况下不付洗牙、补牙、拔牙和假牙', en: 'In most cases no cleanings, fillings, extractions or dentures' }, source: 1 },
    { label: { zh: '福利变动', en: 'Benefit changes' }, value: { zh: '部分成人非急诊牙科变动延至 2027 年 7 月 1 日', en: 'Some adult non-emergency dental changes are delayed to July 1, 2027' }, source: 3 },
    { label: { zh: '低费路线', en: 'Lower-cost options' }, value: { zh: 'NEMS 按收入减费（不是免费诊所）；UCSF 学生诊所接收 Denti-Cal', en: 'NEMS sliding fee (not a free clinic); the UCSF student clinic accepts Denti-Cal' }, source: 6 },
  ],
  contacts: [
    { name: { zh: 'Medi-Cal 牙科服务中心', en: 'Medi-Cal Dental Telephone Service Center' }, number: '1-800-322-6384', tel: '+18003226384',
      note: { zh: '周一到周五 8 点到 17 点；目录里找不到接新病人的牙医时打这个电话，可要求口译。', en: 'Monday–Friday 8 a.m.–5 p.m.; call when the directory has no dentist taking new patients, and ask for an interpreter if needed.' }, source: 2 },
    { name: { zh: 'UCSF Parnassus 学生牙科诊所（老病人）', en: 'UCSF Parnassus Student Dentistry Clinic (returning patients)' }, number: '415-502-5800', tel: '+14155025800',
      note: { zh: '接收 Denti-Cal；新病人用 UCSF 网上自助预约。', en: "Accepts Denti-Cal; new patients book through UCSF's online portal." }, source: 7 },
  ],
  slides: [
    { kind: 'point', kicker: { zh: '先分清', en: 'First' }, title: { zh: '有医保，不等于牙科都能报', en: 'Health insurance is not dental coverage' },
      body: { zh: '大多数常规洗牙、补牙、拔牙、假牙与种植牙不由 Original Medicare 支付；按自己的牙科计划逐项问。', en: 'Original Medicare does not pay for most routine cleanings, fillings, extractions, dentures or implants; ask your dental plan item by item.' }, source: 1 },
    { kind: 'contacts', kicker: { zh: '有 Medi-Cal', en: 'With Medi-Cal' }, title: { zh: '先查官方牙医目录', en: 'Start with the official dentist directory' },
      body: { zh: '按县查找，可只看接收新病人的牙医，也能按普通话、粤语筛选；再打电话确认。', en: 'Search by county, show only dentists taking new patients and filter for Mandarin or Cantonese; then phone to confirm.' },
      phones: [{ label: { zh: '找不到接新病人的牙医', en: 'No dentist taking new patients' }, number: '1-800-322-6384', tel: '+18003226384' }], source: 2 },
    { kind: 'point', kicker: { zh: '福利变动', en: 'Benefit changes' }, title: { zh: '看最新的专门通知', en: 'Read the latest notice' },
      body: { zh: '变动已延到 2027 年 7 月 1 日：从那天起，19 岁以上、因移民身份不符合联邦全额 Medi-Cal 的成人，牙科只保急诊。这不是所有成年人的牙科都取消。', en: 'The change is delayed to July 1, 2027: from then, adults 19+ who do not qualify for federally funded full-scope Medi-Cal because of immigration status keep emergency dental care only. Adult dental care is not cancelled for everyone.' }, source: 3 },
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
