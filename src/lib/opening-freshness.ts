import type { SeptemberOpening } from '../data/september-openings';

const dayStamp = (day: string | undefined): number | undefined => {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const timestamp = Date.parse(`${day}T12:00:00Z`);
  if (Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day) return timestamp;
};

/** Review dates describe evidence freshness, never the first day a business opened. */
export function openingFreshnessLabel(shop: Pick<SeptemberOpening, 'status' | 'openedOn' | 'verifiedAt'>, today: string) {
  if (shop.status === 'announced') return '仍为预告，尚未确认开始营业。';
  const now = dayStamp(today), reviewed = dayStamp(shop.verifiedAt), opened = dayStamp(shop.openedOn);
  if (now === undefined || reviewed === undefined || reviewed > now || now - reviewed >= 30 * 86_400_000) {
    return '营业记录需要重新核查，出发前请确认当前状态。';
  }
  if (shop.openedOn && (opened === undefined || opened > now)) return '首日营业日期待核实，暂不按近期新开推荐。';
  if (opened === undefined) return '营业情况近期核查；首日营业日期未确认。';
  return now - opened <= 90 * 86_400_000 ? '实际首日营业在近 90 天内。' : '保留营业记录，已不属于近 90 天新开。';
}
