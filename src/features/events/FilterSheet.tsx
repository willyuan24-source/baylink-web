import type { ReactNode } from 'react';
import { Button, ChipRow, FilterChip, Sheet } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { TAGS, WHEN_OPTIONS, type EventsFilters, type EventsWhen } from './events-model';

export type FilterSheetProps = {
  open: boolean; onClose: () => void;
  /** The footer's primary label (显示 23 场 / 关闭 / 正在加载…) and the sheet's polite status line. */
  count: string; status: string;
  filters: EventsFilters; defaultWhen: EventsWhen;
  /** The keyword as typed (the URL's q; filters.q is trimmed). */
  query: string;
  /** The one-tap region chips, the same list as rail 2. */
  regions: ReactNode;
  update: (changes: Record<string, string | null>) => void;
  clear: () => void;
  /** On the weekend, its days (周六 / 周日 / 两天都开放): the rail's day chips, here too, as the phone rail at 大 / 特大 shows
   *  only the date choice (UI9-R2 R2-12). None checked is the whole weekend. */
  days?: { items: readonly { id: string; label: string }[]; value: string };
};

/**
 * The 筛选 sheet of the date lists (WeekendView): when (and on the weekend its days), region, what kind (免费 and every
 * tag) and the keyword. Its own
 * chunk, loaded when the page is idle or the sheet first opens, so the routes' first load leaves it out (UI9-EVENTS budgets).
 */
export default function FilterSheet({ open, onClose, count, status, filters, defaultWhen, query, regions, update, clear, days }: FilterSheetProps) {
  const { t, pick } = useUiCopy();
  return <Sheet open={open} onClose={onClose} title={t('筛选活动', 'Filter events')} status={status}
    footer={<>
      <Button variant="text" onClick={clear}>{t('清除', 'Clear')}</Button>
      <Button variant="primary" onClick={onClose}>{count}</Button>
    </>}>
    <SheetSection title={t('什么时候', 'When')}>
      {WHEN_OPTIONS.map(option => <FilterChip key={option.id} selected={filters.when === option.id}
        onClick={() => update({ when: option.id === defaultWhen ? null : option.id, day: null })}>{pick(option.label)}</FilterChip>)}
    </SheetSection>
    {days && days.items.length > 0 && <SheetSection title={t('本周末哪一天', 'Which day this weekend')}>
      {days.items.map(item => <FilterChip key={item.id} selected={days.value === item.id} onClick={() => update({ day: days.value === item.id ? null : item.id })}>{item.label}</FilterChip>)}
    </SheetSection>}
    <SheetSection title={t('地区', 'Region')}>{regions}</SheetSection>
    <SheetSection title={t('想找什么', 'What kind')}>
      <FilterChip selected={filters.free} onClick={() => update({ cost: filters.free ? null : 'free' })}>{t('免费', 'Free')}</FilterChip>
      {TAGS.map(tag => <FilterChip key={tag.id} selected={filters.tag === tag.id} onClick={() => update({ tag: filters.tag === tag.id ? null : tag.id, category: null })}>{pick(tag.label)}</FilterChip>)}
    </SheetSection>
    <label className="ev-search">
      <span>{t('关键词', 'Keyword')}</span>
      <input type="search" value={query} maxLength={200} placeholder={t('活动名、城市或场馆', 'Event, city or venue')}
        onChange={event => update({ q: event.target.value || null })} />
    </label>
  </Sheet>;
}

function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ev-sheet-section"><h3>{title}</h3><ChipRow label={title}>{children}</ChipRow></section>;
}
