import type { GuideEditorial } from './types';
import { seniorServicesEditorial } from './bay-area-chinese-senior-services-referral-guide';
import { medicareEditorial } from './bay-area-medicare-hicap-medi-cal-guide';
import { dentalEditorial } from './bay-area-dental-care-insurance-low-cost-guide';
import { socialSecurityEditorial } from './bay-area-social-security-retirement-preparation-guide';
import { naturalizationEditorial } from './bay-area-naturalization-official-path-guide';
import { freeTaxHelpEditorial } from './bay-area-free-tax-help-vita-calfile-guide';
import { tenantRightsEditorial } from './california-tenant-deposit-rights-help-guide';
import { driverLicenseEditorial } from './california-driver-license-id-preparation-guide';
import { newcomerFirstMonthEditorial } from './bay-area-newcomer-first-month-checklist';
import { rentalScamEditorial } from './bay-area-rental-scam-guide';
import { muniClipperEditorial } from './bay-area-october-muni-clipper-payment-update-2026';
import { halfMoonBayEditorial } from './half-moon-bay-coastal-half-day-guide';
import { firstDoctorEditorial } from './bay-area-first-doctor-insurance-network-guide';
import { localHelpEditorial } from './bay-area-311-211-local-help-guide';
import { sjDigitalHelpEditorial } from './san-jose-digital-help-sj-access-update-2026';
import { bartOctoberEditorial } from './bart-october-access-parking-update-2026';
import { commuteEditorial } from './bay-area-commute-guide';
import { usefulAppsEditorial } from './bay-area-useful-apps-platforms-guide';
import { streetParkingEditorial } from './bay-area-street-parking-first-time-guide';
import { fastrakEditorial } from './bay-area-fastrak-bridge-express-lanes-guide';
import { bulkyItemsEditorial } from './bay-area-bulky-items-ewaste-hhw-guide';
import { alertsEditorial } from './bay-area-alerts-outages-first-day-checklist';
import { freeEslEditorial } from './bay-area-free-esl-adult-learning-guide';
import { repairRequestEditorial } from './bay-area-repair-request-guide';
import { withoutCarEditorial } from './bay-area-without-car-guide';
import { elderScamEditorial } from './bay-area-elder-scam-prevention-guide';
import { seniorTransitEditorial } from './bay-area-senior-transit-clipper-discounts-guide';
import { chineseResourceMapEditorial } from './bay-area-chinese-language-resource-map';

export type { EditorialCopy, EditorialPhone, GuideContact, GuideEditorial, GuideKeyFact, GuideSlide } from './types';

/**
 * Guides with a carousel, 30 秒看懂, contact cards and step conclusions: the eight pilots (senior services + seven paperwork
 * pillars) and, from CNT-GUIDES (Wave 3), a pillar for every topic still missing one: 证件与移民 (newcomer first month),
 * 住房 (rental scams), 出行 (Muni / Clipper), 医疗保险 (first doctor) and 周末出游 (Half Moon Bay).
 */
export const GUIDE_EDITORIAL: Readonly<Record<string, GuideEditorial>> = Object.fromEntries([
  seniorServicesEditorial, medicareEditorial, dentalEditorial, socialSecurityEditorial,
  naturalizationEditorial, freeTaxHelpEditorial, tenantRightsEditorial, driverLicenseEditorial,
  newcomerFirstMonthEditorial, rentalScamEditorial, muniClipperEditorial, halfMoonBayEditorial, firstDoctorEditorial,
  // CNT-GUIDES-2 (H08): every 长辈与家属, 新手必看 and 日常办事 guide except directories (the utilities and 101-city
  // directories, the outlets list), and the three new elder guides (H71).
  localHelpEditorial, sjDigitalHelpEditorial, bartOctoberEditorial, commuteEditorial, usefulAppsEditorial,
  streetParkingEditorial, fastrakEditorial, bulkyItemsEditorial, alertsEditorial, freeEslEditorial, repairRequestEditorial,
  withoutCarEditorial, elderScamEditorial, seniorTransitEditorial, chineseResourceMapEditorial,
].map(editorial => [editorial.slug, editorial]));

export const getGuideEditorial = (slug: string): GuideEditorial | undefined => Object.hasOwn(GUIDE_EDITORIAL, slug) ? GUIDE_EDITORIAL[slug] : undefined;
