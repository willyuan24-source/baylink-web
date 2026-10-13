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
].map(editorial => [editorial.slug, editorial]));

export const getGuideEditorial = (slug: string): GuideEditorial | undefined => Object.hasOwn(GUIDE_EDITORIAL, slug) ? GUIDE_EDITORIAL[slug] : undefined;
