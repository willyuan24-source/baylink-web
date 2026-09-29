import type { SeptemberOpening } from '../data/september-openings';

export const openingStatusLabel = (status: SeptemberOpening['status']): string => ({
  open: '已开业', soft_open: '试营业', announced: '开业预告',
})[status];

export const openingStatusNote = (status: SeptemberOpening['status']): string => ({
  open: '已开业 · 当天营业与订位请查商家入口。',
  soft_open: '试营业 · 营业时段与菜单可能调整，出发前请查商家公告。',
  announced: '开业预告 · 尚未确认正式营业，请先查商家公告。',
})[status];
