import { SaveButton } from '../../components/ui/SaveButton';
import { useSave, type PostSnapshot, type SaveKind } from '../../lib/saves';

/**
 * The ♡ on a card or row, wired to the one save model. `title` is the visible title (already translated); the button
 * reads "收藏：…" / "取消收藏：…". Disabled while a signed-in list is still unknown.
 */
export function SaveHeart({ kind, id, title, post, className }: { kind: SaveKind; id: string; title: string; post?: PostSnapshot; className?: string }) {
  const save = useSave(kind, id, post ? { post } : {});
  return <SaveButton saved={!!save.saved} title={title} className={className} disabled={save.saved === null || save.busy} onToggle={() => void save.toggle()} />;
}
