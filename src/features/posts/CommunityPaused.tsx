import { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import '../../components/ui/ui.css';
import './community.css';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/HeroCard';
import { ModalShell } from '../../components/ui/Modal';
import { useUiCopy } from '../../components/ui/ui-copy';
import { setPageMetadata } from '../../lib/seo';

/**
 * COMMUNITY_VISIBLE = false (src/data/site-flags.ts, H04 fallback): what /category/*, a board search and a post page show
 * instead of the board. One calm H1, where messages are (they keep working), and the two columns that do have content.
 * seo.ts marks these URLs noindex while the switch is off; this component only says it.
 */
export function CommunityPaused() {
  const { t } = useUiCopy();
  return <section className="cm-board cm-paused" data-mode="paused">
    <PageHeader title={t('邻里信息暂停中', 'The neighborhood board is paused')}
      lede={t('邻里信息（测试中）暂时不显示，也暂停发布。已有的私信和联系请求照常在「消息」里。', 'The neighborhood board (beta) is hidden for now, and posting is paused. Your messages and contact requests are still in Messages.')}
      actions={<>
        <Button variant="primary" to="/events">{t('看本周末活动', 'This weekend’s events')}</Button>
        <Button variant="secondary" to="/guides">{t('办事与生活指南', 'How-to guides')}</Button>
        <Button variant="text" to="/messages">{t('消息', 'Messages')}</Button>
      </>} />
  </section>;
}

/** The post sheet's stand-in while the board is paused: the same full-height sheet with 返回, the notice and noindex. */
export function CommunityPausedSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { t } = useUiCopy();
  const title = t('邻里信息暂停中｜BAYLINK', 'The neighborhood board is paused | BAYLINK');
  const description = t('邻里信息（测试中）暂时不显示。', 'The neighborhood board (beta) is hidden for now.');
  useEffect(() => { setPageMetadata({ title, description, path: `/posts/${postId}`, noindex: true, preserveText: true }); }, [postId, title, description]);
  return <ModalShell onClose={onClose} closeOnBackdrop={false} label={t('邻里信息暂停中', 'The neighborhood board is paused')} className="cm-sheet">
    <header className="cm-sheet__toolbar">
      <button type="button" onClick={onClose} className="cm-sheet__back"><ChevronLeft aria-hidden="true" strokeWidth={1.75} />{t('返回', 'Back')}</button>
    </header>
    <div className="cm-sheet__scroll"><div className="cm-sheet__body"><CommunityPaused /></div></div>
  </ModalShell>;
}
