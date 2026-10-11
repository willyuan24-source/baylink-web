import type { GuideEditorial } from './types';
import { seniorServicesEditorial } from './bay-area-chinese-senior-services-referral-guide';
import { medicareEditorial } from './bay-area-medicare-hicap-medi-cal-guide';
import { dentalEditorial } from './bay-area-dental-care-insurance-low-cost-guide';
import { socialSecurityEditorial } from './bay-area-social-security-retirement-preparation-guide';
import { naturalizationEditorial } from './bay-area-naturalization-official-path-guide';
import { freeTaxHelpEditorial } from './bay-area-free-tax-help-vita-calfile-guide';
import { tenantRightsEditorial } from './california-tenant-deposit-rights-help-guide';
import { driverLicenseEditorial } from './california-driver-license-id-preparation-guide';

export type { EditorialCopy, EditorialPhone, GuideContact, GuideEditorial, GuideKeyFact, GuideSlide } from './types';

/** The pilot guides (senior services + the seven pillars) with a carousel, 30 秒看懂, contact cards and step conclusions. */
export const GUIDE_EDITORIAL: Readonly<Record<string, GuideEditorial>> = Object.fromEntries([
  seniorServicesEditorial, medicareEditorial, dentalEditorial, socialSecurityEditorial,
  naturalizationEditorial, freeTaxHelpEditorial, tenantRightsEditorial, driverLicenseEditorial,
].map(editorial => [editorial.slug, editorial]));

export const getGuideEditorial = (slug: string): GuideEditorial | undefined => Object.hasOwn(GUIDE_EDITORIAL, slug) ? GUIDE_EDITORIAL[slug] : undefined;
