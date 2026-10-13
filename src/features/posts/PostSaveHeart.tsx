import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SaveButton } from '../../components/ui/SaveButton';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SAVE_ERROR_COPY, useSave } from '../../lib/saves';
import type { PostData } from '../../lib/types';
import { SaveToast } from '../saves/SaveToast';
import { prepareSaveAnnouncer } from '../saves/save-announcer';

/**
 * ♡ 收藏 for a neighbourhood post: the one save model (src/lib/saves.ts keeps posts in this browser's list) with the
 * same "已收藏 · 查看" confirmation as events and guides (FC3-11). `labelled` is the detail sheet's secondary button; the
 * card shows the round ♡ above its stretched link.
 */
export function PostSaveHeart({ post, title, userId, labelled, className }: { post: PostData; title: string; userId: string | null | undefined; labelled?: boolean; className?: string }) {
  const { t } = useUiCopy();
  // The owner is passed in: the post sheet renders outside the route outlet, where the app context is not available.
  const save = useSave('post', post.id, { userId: userId ?? null, post: { id: post.id, title: post.title, city: post.city, category: post.category, budget: post.budget } });
  const [toast, setToast] = useState('');
  const toggle = async () => {
    setToast('');
    prepareSaveAnnouncer();
    const result = await save.toggle();
    if (result?.saved) setToast(t('已收藏', 'Saved'));
  };
  const saved = !!save.saved;
  return <>
    {labelled
      ? <Button variant="secondary" className={`cm-action${className ? ` ${className}` : ''}`} aria-pressed={saved} onClick={() => void toggle()}
        aria-label={saved ? t(`取消收藏：${title}`, `Remove from saved: ${title}`) : t(`收藏：${title}`, `Save: ${title}`)} icon={<Heart aria-hidden="true" strokeWidth={1.75} />}>
        {saved ? t('已收藏', 'Saved') : t('收藏', 'Save')}
      </Button>
      : <SaveButton saved={saved} title={title} className={className} onToggle={() => void toggle()} />}
    {save.error && <span className="cm-save-error" role="alert">{t(SAVE_ERROR_COPY[save.error].zh, SAVE_ERROR_COPY[save.error].en)}</span>}
    {toast && <SaveToast message={toast} actionLabel={t('查看', 'View')} to="/my-week#saved" closeLabel={t('关闭提示', 'Dismiss')} onClose={() => setToast('')} />}
  </>;
}
