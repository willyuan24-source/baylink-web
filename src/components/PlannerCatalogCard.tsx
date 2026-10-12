import type { ReactNode } from 'react';
import { Heart, Plus } from 'lucide-react';
import { translateText, useLocale } from '../i18n/locale';
import { stopPath, type GeoPoint, type Stop } from '../lib/planner';
import type { ResolvedCover } from '../lib/cover';
import { Button } from './ui/Button';
import { RowCard } from './ui/Card';
import { PlannerStopThumb } from './PlannerStopCover';
import { PlannerStopOffers } from './PlannerStopOffers';

export type PlannerCatalogItem = Stop & { title: string; city: string; summary: string; kicker: string; detail: string; point?: GeoPoint; official: string };

/**
 * One event or place in the planner's list (行程, plan T13): a RowCard with its cover (getCover via PlannerStopThumb),
 * kicker (date or kind) and one meta line, the ♡ as its one trailing action, then the summary, any offers and the two
 * planning actions. The map pin number, when the stop is on the map, leads the kicker.
 */
export function PlannerCatalogCard({ item, cover, today, date, pin, selected, favorite, favoriteReady, busy, replacing, onToggleFavorite, onAdd, onStart, children }: {
  item: PlannerCatalogItem; cover: ResolvedCover; today: string; date: string; pin: number; selected: boolean;
  favorite: boolean; favoriteReady: boolean; busy: boolean; replacing: boolean;
  onToggleFavorite: () => void; onAdd: () => void; onStart?: () => void; children?: ReactNode;
}) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const key = `${item.kind}:${item.id}`;
  const path = stopPath(item);
  const external = /^https?:/.test(path);
  const heartLabel = !favoriteReady ? (locale === 'en' ? 'Saved status unavailable' : translateText('收藏状态待载入', locale)) : translateText(favorite ? '取消收藏' : '收藏到我的这周', locale);
  return <div id={`catalog-${key}`} className={`planner-place${selected ? ' is-selected' : ''}`}>
    <RowCard title={translateText(item.title, locale)} {...(external ? { href: path } : { to: path })}
      thumb={<PlannerStopThumb stop={item} cover={cover} today={today} />}
      date={<>{pin >= 0 && <span className="planner-pin-no" title={t('地图上的编号', 'Number on the map')}>{pin + 1}</span>}{translateText(item.kicker, locale)}</>}
      meta={`${translateText(item.city, locale)} · ${item.detail}`}
      trailing={<button type="button" className="planner-heart" aria-label={heartLabel} aria-pressed={favoriteReady ? favorite : undefined} disabled={!favoriteReady || busy} onClick={onToggleFavorite}><Heart size={20} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} /></button>} />
    {item.summary && <p className="planner-place-summary">{item.summary}</p>}
    <PlannerStopOffers stop={item} date={date} />
    <div className="planner-place-actions">
      <Button variant="tonal" icon={<Plus size={16} aria-hidden="true" />} onClick={onAdd}>{translateText(replacing ? '替换选中站点' : '加入计划', locale)}</Button>
      {onStart && <Button variant="text" onClick={onStart}>{t('以这里为起点', 'Start here')}</Button>}
    </div>
    {item.point && <p className="planner-place-links">
      <a href={`https://www.google.com/maps/search/?api=1&query=${item.point.lat},${item.point.lng}`} target="_blank" rel="noreferrer">{translateText('查看地图与路线 ↗', locale)}</a>
      <a href={item.point.sourceUrl} target="_blank" rel="noreferrer">{translateText('坐标来源 ↗', locale)}</a>
    </p>}
    {children}
  </div>;
}
