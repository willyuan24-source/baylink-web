const FOUNDER_BUSINESS_AD_IDS = new Set(['1779339769392']);

/** Relationship disclosure is explicit editorial metadata, never inferred from a person's name. */
export function adRelationshipDisclosure(id: string): string | undefined {
  return FOUNDER_BUSINESS_AD_IDS.has(id) ? '关联披露：此服务由 BAYLINK 创办人经营。' : undefined;
}
