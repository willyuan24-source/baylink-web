/**
 * New official figures written into the pillar guides by CNT-GUIDES (Wave 3). Each was read on the official page on the
 * date given, with the quote copied from that page (also in docs/source-reads-2026-10.md), and is listed for the owner in the
 * lane PR under "新官方数字（请店主过目）". Tests only (tests/guide-official-figures.test.ts): every dollar amount in a pillar
 * guide must be registered here, and every registered figure must still be written in its guide. Not imported by the app.
 */
export type OfficialFigure = { slug: string; figure: string; url: string; readOn: string; quote: string };

const VITA = 'bay-area-free-tax-help-vita-calfile-guide';
const MEDICARE = 'bay-area-medicare-hicap-medi-cal-guide';
const DEPOSIT = 'california-tenant-deposit-rights-help-guide';
const SSA = 'bay-area-social-security-retirement-preparation-guide';
const NATURALIZATION = 'bay-area-naturalization-official-path-guide';
const DRIVER = 'california-driver-license-id-preparation-guide';
const DENTAL = 'bay-area-dental-care-insurance-low-cost-guide';
const SENIOR = 'bay-area-chinese-senior-services-referral-guide';

export const OFFICIAL_FIGURES: readonly OfficialFigure[] = [
  { slug: VITA, figure: '$70,244', url: 'https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers', readOn: '2026-10-12',
    quote: 'People who generally make about $70,244 or less' },
  { slug: VITA, figure: '888-227-7669', url: 'https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers', readOn: '2026-10-12',
    quote: 'To locate the nearest AARP TCE Tax-Aide site between January and April use the AARP Site Locator Tool or call 888-227-7669' },
  { slug: VITA, figure: '2023、2024 和 2025', url: 'https://www.ftb.ca.gov/file/ways-to-file/online/calfile/index.asp', readOn: '2026-10-12',
    quote: 'Free - CalFile is completely free. … We now accept 2023, 2024, and 2025.' },
  { slug: MEDICARE, figure: '$202.90', url: 'https://www.medicare.gov/basics/costs/medicare-costs', readOn: '2026-10-12',
    quote: 'What you pay in 2026: Premium Monthly $202.90 each month (or higher depending on your income)' },
  { slug: MEDICARE, figure: '$283', url: 'https://www.medicare.gov/basics/costs/medicare-costs', readOn: '2026-10-12',
    quote: 'Deductible Yearly $283 before Original Medicare starts to pay' },
  { slug: MEDICARE, figure: '$1,736', url: 'https://www.medicare.gov/basics/costs/medicare-costs', readOn: '2026-10-12',
    quote: 'Deductible Each benefit period $1,736 for each inpatient hospital benefit period' },
  { slug: MEDICARE, figure: '10%', url: 'https://www.medicare.gov/basics/costs/medicare-costs', readOn: '2026-10-12',
    quote: "You'll typically pay an extra 10% for each year you could have signed up for Part B, but didn't." },
  { slug: MEDICARE, figure: '$130,000', url: 'https://www.dhcs.ca.gov/medi-cal/help/asset-limit-frequently-asked-questions/', readOn: '2026-10-12',
    quote: 'Through June 30, 2027: The most you can own (asset limit) is $130,000 for one person. Add $65,000 for every extra person in your house (up to 10 people).' },
  { slug: MEDICARE, figure: '$65,000', url: 'https://www.dhcs.ca.gov/medi-cal/help/asset-limit-frequently-asked-questions/', readOn: '2026-10-12',
    quote: 'Add $65,000 for every extra person in your house (up to 10 people).' },
  { slug: MEDICARE, figure: '$21,000', url: 'https://www.dhcs.ca.gov/medi-cal/help/asset-limit-frequently-asked-questions/', readOn: '2026-10-12',
    quote: 'Starting July 1, 2027, the asset limit is: $21,000 for one person. $31,000 for two people.' },
  { slug: MEDICARE, figure: '$31,000', url: 'https://www.dhcs.ca.gov/medi-cal/help/asset-limit-frequently-asked-questions/', readOn: '2026-10-12',
    quote: 'Starting July 1, 2027, the asset limit is: $21,000 for one person. $31,000 for two people.' },
  { slug: DEPOSIT, figure: '$125', url: 'https://selfhelp.courts.ca.gov/guide-security-deposits-california', readOn: '2026-10-12',
    quote: 'If the deductions are for more than $125.00, the landlord must attach a copy of any invoices or receipts with the itemized statement.' },
  { slug: DEPOSIT, figure: '$12,500', url: 'https://selfhelp.courts.ca.gov/guide-security-deposits-california', readOn: '2026-10-12',
    quote: "A person who's a tenant can only sue for up to $12,500 in small claims court." },
  { slug: DEPOSIT, figure: '800-884-1684', url: 'https://calcivilrights.ca.gov/housing/', readOn: '2026-10-12',
    quote: 'Regional Offices 800-884-1684 (voice)' },
  { slug: SSA, figure: '$1,890', url: 'https://www.ssa.gov/benefits/retirement/planner/credits.html', readOn: '2026-10-12',
    quote: 'In 2026, you earn one Social Security and Medicare credit for every $1,890 in covered earnings each year.' },
  { slug: SSA, figure: '$7,560', url: 'https://www.ssa.gov/benefits/retirement/planner/credits.html', readOn: '2026-10-12',
    quote: 'You must earn $7,560 to get the maximum four credits for the year.' },
  { slug: SSA, figure: '2.8%', url: 'https://www.ssa.gov/cola/', readOn: '2026-10-12',
    quote: 'The 2.8 percent cost-of-living adjustment (COLA) will begin with benefits payable to nearly 71 million Social Security beneficiaries in January 2026.' },
  { slug: NATURALIZATION, figure: '$760', url: 'https://www.uscis.gov/n-400', readOn: '2026-10-12',
    quote: 'Submit $760 if filing by paper, or $710 if filing online' },
  { slug: NATURALIZATION, figure: '$710', url: 'https://www.uscis.gov/n-400', readOn: '2026-10-12',
    quote: 'Submit $760 if filing by paper, or $710 if filing online' },
  { slug: NATURALIZATION, figure: '$380', url: 'https://www.uscis.gov/n-400', readOn: '2026-10-12',
    quote: 'Submit $380 and documentation to support the reduced fee' },
  { slug: NATURALIZATION, figure: '2025 年 10 月 20 日', url: 'https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test', readOn: '2026-10-12',
    quote: 'Aliens who file Form N-400 to apply for naturalization on or after Oct. 20, 2025, will take the 2025 naturalization civics test.' },
  { slug: DRIVER, figure: '$46', url: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/licensing-fees/', readOn: '2026-10-12',
    quote: 'Class C – Original – Renewal – Adding a motorcycle license (Class M1/M2) $46' },
  { slug: DRIVER, figure: '12 个月', url: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/driver-licenses-dl/', readOn: '2026-10-12',
    quote: 'Pay the nonrefundable application fee (application and fee valid for 12 months).' },
  { slug: DRIVER, figure: '3 次', url: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/driver-licenses-dl/', readOn: '2026-10-12',
    quote: 'You are allowed three attempts to pass each of the required knowledge tests.' },
  { slug: DRIVER, figure: '80%', url: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/learners-permits/', readOn: '2026-10-12',
    quote: "There are multiple choice questions based on the California Driver's Handbook, and a passing score is 80%." },
  { slug: DRIVER, figure: '4:30', url: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/learners-permits/', readOn: '2026-10-12',
    quote: 'To allow sufficient testing time, tests are not available at DMV offices after 4:30 p.m.' },
  { slug: DRIVER, figure: '中文练习题', url: 'https://www.dmv.ca.gov/portal/driver-education-and-safety/educational-materials/sample-driver-license-dl-knowledge-tests/', readOn: '2026-10-12',
    quote: 'Regular driver (Class C license) English Español Armenian Chinese Farsi Punjabi Russian Tagalog Vietnamese' },
  { slug: DRIVER, figure: '笔试要预约', url: 'https://www.dmv.ca.gov/portal/driver-education-and-safety/special-interest-driver-guides/senior-drivers/', readOn: '2026-10-12',
    quote: 'The in-person Knowledge Test requires you to schedule an appointment … If you take the written test in a foreign language, you must also take a traffic signs test.' },
  { slug: DENTAL, figure: '415-502-5800', url: 'https://dentistry.ucsf.edu/dental-center/clinics/student-general-dentistry-clinic-parnassus', readOn: '2026-10-12',
    quote: "If you're an existing patient, please call us at 415-502-5800 … Denti-Cal: This clinic accepts Denti-Cal." },
  { slug: DENTAL, figure: '8 点到 17 点', url: 'https://www.dental.dhcs.ca.gov/Members/Medi-Cal_Dental/Find_A_Dentist/', readOn: '2026-10-12',
    quote: 'Medi-Cal Dental Telephone Service Center between 8 a.m. and 5 p.m. Monday through Friday by calling 1-800-322-6384.' },
  { slug: SENIOR, figure: '免费', url: 'https://familybridges.org/visiting-program/', readOn: '2026-10-12',
    quote: 'No Fees: This program is free. Donations are always welcome. Office Hours Monday – Friday 9:00 a.m. to 3:00 p.m.' },
  { slug: SENIOR, figure: '12 个月', url: 'https://www.selfhelpelderly.org/our-services/health-and-home-care/senior-care/adult-day-services', readOn: '2026-10-12',
    quote: 'Proof of tuberculosis clearance within the past 12 months is also a requirement.' },
];
