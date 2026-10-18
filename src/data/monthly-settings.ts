// Shared metadata stays separate from the full event catalog.
export const MONTHLY_EDITION = {
  month: '2026-11', startMonth: '2026-09', throughDate: '2027-02-28',
  label: '2026 年秋冬 · 收录至 2027/2/28', checkedAt: '2026-10-07',
  // The latest content batch (CNT-SUPPLY-3, src/data/supply-2026-10-15-*; CNT-SUPPLY-2's is supply-2026-10-13-*, CNT-SUPPLY's
  // supply-2026-10-12-*): its items carry their own verifiedAt. checkedAt stays the edition's check date, so the events header
  // never claims the older items were re-checked that day. throughDate 2027-01-03 came with the 2026-10-15 batch (the winter-break
  // weekends 12/19–20, 12/26–27 and 1/2–3, read on 2026-10-15); CNT-WEEKEND-1128 runs it to 2027-02-28 so the dated 2027 Lunar New
  // Year programmes (src/data/lny-2027-2026-10-17-*, read on 2026-10-17; New Year's Day is 2/6) are listed. Between 1/4 and 2/28
  // only those and the seasonal runs with published later days are in the catalog until the next supply batch. The GPT editor's
  // source review of the 10/17–18 and 10/24–25 weekends set verifiedAt 2026-10-15 on the items it found consistent
  // (docs/source-reads-2026-10.md). CNT-FRESH-1016 adds two
  // November SFPL items read on 2026-10-16 (src/data/supply-2026-10-16-*), and the editor's third review (11/7–8, 11/14–15,
  // 11/21–22) set 2026-10-16. CNT-WEEKEND-1128 adds Portola Valley's sewing-machine basics read on 2026-10-17
  // (src/data/weekend-1128-2026-10-17-*), so updatedAt is that day (no item may claim a later verifiedAt).
  updatedAt: '2026-10-17',
  title: '这个秋天，把周末留给湾区。',
  intro: '从十月的周末、十二月的节日到 2027 年春节，按地区挑选已公布的活动、优惠、新店与半日游。每条保留来源、核对日期和适用条件，预告与已确认安排分别标注。',
};
