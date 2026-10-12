import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Button, ChipRow, FilterChip, Sheet } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { ALL_REGIONS, REGIONS, regionLabel, saveRegion } from './events-model';
import type { MonthlyRegion } from './events-index-types';

/** Sets the region the way 本周末 does: in the address (?region=…, so Back and a shared link keep it) and remembered. */
function useSetRegion() {
  const [, setParams] = useSearchParams();
  return (region: MonthlyRegion | 'all') => {
    saveRegion(region);
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('region', region);
      return next;
    }, { replace: true, preventScrollReset: true });
  };
}

/**
 * The boards' region chip (整个湾区 ▾ / 南湾 ▾). The region a reader picked on 本周末 is remembered and narrows 免费与优惠
 * and 新店 too, so each board shows it and can change it here; the Sheet announces what closing it shows.
 */
export function RegionFilter({ region, status }: { region: MonthlyRegion | 'all'; status: string }) {
  const { t, pick } = useUiCopy();
  const [open, setOpen] = useState(false);
  const setRegion = useSetRegion();
  return <>
    <FilterChip selected={region !== 'all'} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      {pick(regionLabel(region))}<ChevronDown className="ev-chip-caret" aria-hidden="true" strokeWidth={1.75} />
    </FilterChip>
    <Sheet open={open} onClose={() => setOpen(false)} title={t('选择地区', 'Choose a region')} status={status}
      footer={<Button variant="primary" onClick={() => setOpen(false)}>{status}</Button>}>
      <ChipRow label={t('地区', 'Region')}>
        <FilterChip selected={region === 'all'} onClick={() => setRegion('all')}>{pick(ALL_REGIONS)}</FilterChip>
        {REGIONS.map(item => <FilterChip key={item.id} selected={region === item.id} onClick={() => setRegion(item.id)}>{pick(item.label)}</FilterChip>)}
      </ChipRow>
    </Sheet>
  </>;
}
