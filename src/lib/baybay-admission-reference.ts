import type { BayBayAdmissionFacts } from './baybay-assistant';

/** A sourced group admission amount is separate from date eligibility and full-trip costs.
 * Parsed facts already resolve source IDs; live cards also check their visible evidence.
 * Partial adult-only prices must not imply that an unpriced child is included. */
export function sourcedAdmissionSubtotal(facts: (BayBayAdmissionFacts | undefined)[], partySize?: number | null, evidenceIds?: ReadonlySet<string>): number | undefined {
  if (!facts.length) return;
  let total = 0;
  for (const item of facts) {
    if (!item || item.status === 'unknown' || item.knownTotalUsd === undefined || !Number.isFinite(item.knownTotalUsd) || item.knownTotalUsd < 0
      || item.applicability.dateStatus === 'out-of-range' || !item.sourceIds.some(id => id && (!evidenceIds || evidenceIds.has(id)))
      || !item.breakdown.length) return;
    const group = item.breakdown.length === 1 && item.breakdown[0].category === 'group' && item.breakdown[0].quantity === 1;
    if (!group && (!Number.isInteger(partySize) || !partySize || item.breakdown.some(row => row.category === 'group')
      || item.breakdown.reduce((sum, row) => sum + row.quantity, 0) !== partySize)) return;
    if (item.breakdown.some(row => !Number.isInteger(row.quantity) || row.quantity < 1 || !Number.isFinite(row.unitUsd) || row.unitUsd < 0
      || !Number.isFinite(row.subtotalUsd) || Math.abs(row.quantity * row.unitUsd - row.subtotalUsd) > 0.011)
      || Math.abs(item.breakdown.reduce((sum, row) => sum + row.subtotalUsd, 0) - item.knownTotalUsd) > 0.011) return;
    total += item.knownTotalUsd;
  }
  return Math.round(total * 100) / 100;
}
