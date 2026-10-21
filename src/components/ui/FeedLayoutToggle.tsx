import { LayoutGrid, List } from 'lucide-react';
import { IconButton } from './Button';
import { useUiCopy } from './ui-copy';
import type { FeedLayout } from './feed-layout';

/**
 * Two 44px buttons that override the automatic column choice; the choice is remembered (baylink.feed-layout.v1).
 * Pressing the layout the automatic switch would pick clears the saved choice (`useFeedLayout().setLayout`).
 * Its own module (UI9-EVENTS): only the community board shows it, so the home and events feeds that render FeedGrid no longer
 * download it and its two icons. FeedGrid.tsx re-exports it; its styles (.ui-layout-toggle) stay in cards.css.
 */
export function FeedLayoutToggle({ effective, onChange }: { effective: Exclude<FeedLayout, 'auto'>; onChange: (layout: FeedLayout) => void }) {
  const { t } = useUiCopy();
  return <div className="ui-layout-toggle" role="group" aria-label={t('排列方式', 'Layout')}>
    <IconButton label={t('多列', 'Grid', '多欄')} aria-pressed={effective === 'grid'} onClick={() => onChange('grid')}><LayoutGrid aria-hidden="true" strokeWidth={1.75} /></IconButton>
    <IconButton label={t('单列', 'One column', '單欄')} aria-pressed={effective === 'list'} onClick={() => onChange('list')}><List aria-hidden="true" strokeWidth={1.75} /></IconButton>
  </div>;
}
