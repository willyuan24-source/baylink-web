import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, ChipRow, FilterChip, Sheet } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { ALL_REGIONS, REGIONS, regionLabel } from './events-model';
import type { MonthlyRegion } from './events-index-types';
import { useSetRegion } from './board-mode';

/** A chip that opens a Sheet ("整个湾区 ▾", "全部条件 ▾"): selected when it narrows the board. */
export function SheetChip({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return <FilterChip selected={selected} aria-haspopup="dialog" onClick={onClick}>
    {label}<ChevronDown className="fb-chip-caret" aria-hidden="true" strokeWidth={1.75} />
  </FilterChip>;
}

/**
 * The boards' region chip (整个湾区 ▾ / 南湾 ▾). The region a reader picked on 本周末 is remembered and narrows 免费与优惠
 * and 新店 too (one URL parameter, one label on every view), so each board shows it and can change it here; the Sheet
 * announces what closing it shows. Options carry no counts (DECISIONS 19).
 */
export function RegionFilter({ region, status }: { region: MonthlyRegion | 'all'; status: string }) {
  const { t, pick } = useUiCopy();
  const [open, setOpen] = useState(false);
  const setRegion = useSetRegion();
  return <>
    <SheetChip selected={region !== 'all'} label={pick(regionLabel(region))} onClick={() => setOpen(true)} />
    <Sheet open={open} onClose={() => setOpen(false)} title={t('选择地区', 'Choose a region')} status={status}
      footer={<Button variant="primary" onClick={() => setOpen(false)}>{status}</Button>}>
      <ChipRow label={t('地区', 'Region')}>
        <FilterChip selected={region === 'all'} onClick={() => setRegion('all')}>{pick(ALL_REGIONS)}</FilterChip>
        {REGIONS.map(item => <FilterChip key={item.id} selected={region === item.id} onClick={() => setRegion(item.id)}>{pick(item.label)}</FilterChip>)}
      </ChipRow>
    </Sheet>
  </>;
}

/**
 * The second Sheet chip of the roomy filter pair ([全部条件 ▾]): the same options as the standard chip row, in a Sheet whose
 * footer says what closing it shows.
 */
export function OptionSheetFilter<T extends string>({ label, title, value, options, onChange, status }: {
  label: string; title: string; value: T; options: readonly { id: T; label: ReactNode }[]; onChange: (value: T) => void; status: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find(option => option.id === value);
  return <>
    <SheetChip selected={value !== options[0]?.id} label={value === options[0]?.id ? label : String(chosen?.label ?? label)} onClick={() => setOpen(true)} />
    <Sheet open={open} onClose={() => setOpen(false)} title={title} status={status}
      footer={<Button variant="primary" onClick={() => setOpen(false)}>{status}</Button>}>
      <ChipRow label={title}>
        {options.map(option => <FilterChip key={option.id} selected={value === option.id} onClick={() => onChange(option.id)}>{option.label}</FilterChip>)}
      </ChipRow>
    </Sheet>
  </>;
}
