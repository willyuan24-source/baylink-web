import { MONTHLY_EVENTS } from '../data/monthly-edition';
import { ATTRACTIONS } from '../data/attractions';
import { guides } from '../data/guides';
import type { MonthlyEvent } from '../data/monthly-types';
import type { PageMetadata } from './seo';

export type GeoPoint = { lat: number; lng: number; label: string; sourceUrl: string; precision: 'venue' | 'area' };
export type PlanningFacts = { setting?: 'indoor' | 'outdoor' | 'mixed'; admissionUsd?: number | null; minAge?: number | null; maxAge?: number | null; reservation?: 'required' | 'optional' | 'unknown' };
export type PlannerEvent = MonthlyEvent & { location?: GeoPoint; planning?: PlanningFacts };
export type PlannerPlace = { id: string; title: string; region: string; city: string; summary: string; guideSlug: string; officialUrl: string; cost: string; location?: GeoPoint; planning?: PlanningFacts };
export type Stop = { kind: 'event' | 'place'; id: string };
export type Favorite = { kind: 'event' | 'place' | 'guide'; id: string };
export type SavedPlan = { id: string; title: string; date: string; stops: Stop[]; version: number; createdAt: string; updatedAt: string };
export type Preferences = { regions: string[]; interests: string[]; travelMode: string };
export type Library = { plans: SavedPlan[]; favorites: Favorite[]; preferences: Preferences };
export type PlanFilters = { date?: string; region?: string; city?: string; budget?: number | null; childAge?: number | null; setting?: string; travelMode?: string };
export type Suggestion = { id: string; date: string; eventId: string; placeIds: string[]; reason: string; reasons: string[]; unknowns: string[] };
export type Recommendations = { ok: boolean; responseMode: 'ai' | 'rules'; filters: PlanFilters; suggestions: Suggestion[]; notices: string[]; checkedAt: string };
export const PLAN_METADATA: PageMetadata = { title: 'BayBay 智能出游计划｜BAYLINK', description: '说出日期、地区和预算，从真实湾区活动选择方案，在地图上搭配景点，保存与分享出游计划。', path: '/plan' };
export const WEEK_METADATA: PageMetadata = { title: '我的这周｜BAYLINK', description: '在一个地方整理自己的湾区活动、收藏和出游计划。', path: '/my-week', noindex: true };
export const EMPTY_LIBRARY: Library = { plans: [], favorites: [], preferences: { regions: [], interests: [], travelMode: 'any' } };
export const todayInBay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const eventFor = (id: string) => MONTHLY_EVENTS.find(item => item.id === id);
export const placeFor = (id: string) => ATTRACTIONS.find(item => item.id === id);
export const validStop = (stop: Stop) => stop?.kind === 'event' ? !!eventFor(stop.id) : stop?.kind === 'place' && !!placeFor(stop.id);
export const stopTitle = (stop: Stop) => (stop.kind === 'event' ? eventFor(stop.id) : placeFor(stop.id))?.title || stop.id;
export const stopPath = (stop: Stop) => stop.kind === 'event' ? `/events/${encodeURIComponent(stop.id)}` : `/guides/${encodeURIComponent(placeFor(stop.id)?.slug || '')}`;
export const favoriteTitle = (favorite: Favorite) => favorite.kind === 'guide' ? guides.find(guide => guide.slug === favorite.id)?.title || favorite.id : stopTitle({ kind: favorite.kind, id: favorite.id });
export const favoritePath = (favorite: Favorite) => favorite.kind === 'guide' ? `/guides/${encodeURIComponent(favorite.id)}` : stopPath({ kind: favorite.kind, id: favorite.id });
export const cleanStops = (input: unknown): Stop[] => Array.isArray(input) ? input.filter((stop): stop is Stop => !!stop && validStop(stop)).filter((stop, i, all) => all.findIndex(other => other.kind === stop.kind && other.id === stop.id) === i).slice(0, 3) : [];
/** Shared URLs contain public catalog references only, never account IDs or private notes. */
export function sharePlanUrl(plan: Pick<SavedPlan, 'date' | 'stops'>, origin = 'https://www.baylink.us') {
  const url = new URL('/plan', origin);
  if (validDay(plan.date)) url.searchParams.set('date', plan.date);
  url.searchParams.set('stops', cleanStops(plan.stops).map(stop => `${stop.kind}:${stop.id}`).join(','));
  return url.href;
}
export function parseSharedPlan(search: string): { date: string; stops: Stop[] } {
  const query = new URLSearchParams(search);
  const stops = (query.get('stops') || '').split(',').slice(0, 12).map(part => { const [kind, id] = part.split(':'); return { kind, id }; });
  const legacy = (query.get('places') || '').split(',').map(id => ({ kind: 'place', id }));
  const date = query.get('date') || '';
  return { date: validDay(date) ? date : '', stops: cleanStops([...stops, ...legacy]) };
}
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export const errorText = (error: unknown) => {
  const value = error as { status?: number; error?: string; message?: string };
  return value?.status === 409 ? '其他设备已更新这份计划，请刷新后再编辑。' : value?.error || value?.message || '暂时无法保存，请稍后重试。';
};
