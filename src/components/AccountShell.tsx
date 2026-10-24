import { PageContainer } from './ui/PageHeader';
import { SkeletonCard, SkeletonRow } from './ui/SkeletonCard';
import { useUiCopy } from './ui/ui-copy';
import type { AccountShellPage } from '../app/account-shell';

const Block = ({ shape }: { shape: string }) => <span className="ui-skeleton account-shell__block" data-block={shape} />;

/**
 * The prerendered first paint of the account pages (src/app/account-shell.ts writes one file per shape): no page heading
 * of its own (each page has its own H1 once the app renders it), one polite loading line, and placeholders shaped like the
 * page that will arrive (DECISIONS 41, NAV PR B: not four generic rows), on the page's own frame (x = 112 at 1440):
 * - me: the photo band, the avatar and name, the four tiles (2 x 2 on a phone), the settings list;
 * - week: the title, the 行程 section with its empty line and the picture strip, then rows;
 * - together: the photo band, the head, the search field with the 筛选 chip, the list's empty state;
 * - list (/messages, /me/bookings): the title over rows.
 * Every block has a fixed height, so nothing jumps while it shows; the window-tall frame keeps the footer below the fold.
 */
export function AccountShell({ page = 'list' }: { page?: AccountShellPage }) {
  const { t } = useUiCopy();
  return <PageContainer size="wide" className="account-shell">
    <div className="account-shell__page" data-page={page} aria-busy="true">
      <p className="ui-visually-hidden" role="status">{t('正在加载', 'Loading')}</p>
      <div aria-hidden="true">
        {page === 'me' && <>
          <Block shape="band" />
          <div className="account-shell__head"><Block shape="avatar" /><div><Block shape="title" /><Block shape="line" /></div></div>
          <div className="account-shell__tiles">{[0, 1, 2, 3].map(index => <Block key={index} shape="tile" />)}</div>
          <Block shape="section" /><Block shape="list" />
        </>}
        {page === 'week' && <>
          <Block shape="title" /><Block shape="line" /><Block shape="notice" />
          <Block shape="section" /><Block shape="empty" />
          <ul className="ui-feed-grid account-shell__feed" data-layout="auto">{[0, 1, 2, 3].map(index => <li key={index}><SkeletonCard /></li>)}</ul>
          <Block shape="section" /><SkeletonRow /><SkeletonRow />
        </>}
        {page === 'together' && <>
          <Block shape="band" /><Block shape="title" /><Block shape="lede" />
          <div className="account-shell__bar"><Block shape="field" /><Block shape="chip" /></div>
          <Block shape="state" />
        </>}
        {page === 'list' && <><Block shape="title" />{[0, 1, 2, 3].map(index => <SkeletonRow key={index} />)}</>}
      </div>
    </div>
  </PageContainer>;
}
