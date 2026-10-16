// Shared metadata stays separate from the full event catalog.
export const MONTHLY_EDITION = {
  month: '2026-11', startMonth: '2026-09', throughDate: '2027-01-03',
  label: '2026 年秋冬 · 收录至 2027/1/3', checkedAt: '2026-10-07',
  // The latest content batch (CNT-SUPPLY-3, src/data/supply-2026-10-15-*; CNT-SUPPLY-2's is supply-2026-10-13-*, CNT-SUPPLY's
  // supply-2026-10-12-*): its items carry their own verifiedAt. checkedAt stays the edition's check date, so the events header
  // never claims the older items were re-checked that day. throughDate 2027-01-03: the 2026-10-15 batch reaches the winter-break
  // weekends (12/19–20, 12/26–27, 1/2–3); it was read on 2026-10-15, so updatedAt is that day (no item claims a later verifiedAt).
  updatedAt: '2026-10-15',
  title: '这个秋天，把周末留给湾区。',
  intro: '从十月的周末到十二月的节日，按地区挑选已公布的活动、优惠、新店与半日游。每条保留来源、核对日期和适用条件，预告与已确认安排分别标注。',
};
