import { Heart } from 'lucide-react';
import './ui.css';
import { cx, useUiCopy } from './ui-copy';

/**
 * The ♡ toggle (visual only; WEB-SAVES wires the one save model). 32px circle, 44px hit area, `aria-pressed`.
 * Always a sibling of a card link, never inside it.
 */
export function SaveButton({ saved, title, onToggle, className, disabled }: { saved: boolean; title: string; onToggle: () => void; className?: string; disabled?: boolean }) {
  const { t } = useUiCopy();
  const label = saved ? t(`取消收藏：${title}`, `Remove from saved: ${title}`) : t(`收藏：${title}`, `Save: ${title}`);
  return <button type="button" className={cx('ui-save', className)} aria-pressed={saved} aria-label={label} disabled={disabled} onClick={onToggle}>
    <Heart aria-hidden="true" strokeWidth={1.75} />
  </button>;
}
