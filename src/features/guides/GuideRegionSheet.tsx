import { Sheet } from '../../components/ui/Sheet';
import { useUiCopy } from '../../components/ui/ui-copy';
import { GUIDE_REGIONS, type GuideRegionId } from './guide-facts';

/**
 * 地区 on /guides (UI9-GUIDES): F's Sheet with 整个湾区 and the five regions. A chunk of its own, loaded on the first tap of the
 * 地区 ▾ chip, so the index route does not carry the sheet (route JS ≤ base).
 */
export default function GuideRegionSheet({ open, region, onClose, onPick }: { open: boolean; region: GuideRegionId | null; onClose: () => void; onPick: (region: GuideRegionId | null) => void }) {
  const { t, pick } = useUiCopy();
  return <Sheet open={open} onClose={onClose} title={t('地区', 'Region')} bodyClassName="gl-regions">
    <ul className="gl-regions__list">{[{ id: null, label: t('整个湾区', 'Whole Bay Area') }, ...GUIDE_REGIONS.map(item => ({ id: item.id, label: pick(item) }))].map(item => <li key={item.id ?? 'all'}>
      <button type="button" className="gl-regions__option" aria-pressed={region === item.id} onClick={() => onPick(item.id)}>{item.label}</button>
    </li>)}</ul>
  </Sheet>;
}
