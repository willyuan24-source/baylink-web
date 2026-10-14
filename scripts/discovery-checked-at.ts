/**
 * The discovery catalog's check date comes from the data, never the build day: the newest `verifiedAt` of the exported
 * items. A rebuild on another day then writes the same files, and the API (which reads `checkedAt` as the recorded date
 * of the few offers without their own `verifiedAt`) never sees a date nobody checked anything on. Kept free of side
 * effects so tests can import it without running the export.
 */
export function discoveryCheckedAt(items: readonly { verifiedAt?: string }[]): string {
  const newest = items.map(item => item.verifiedAt?.slice(0, 10)).filter((day): day is string => !!day && /^\d{4}-\d{2}-\d{2}$/.test(day)).sort().at(-1);
  if (!newest) throw new Error('discovery context: no exported item has a verifiedAt date');
  return newest;
}
