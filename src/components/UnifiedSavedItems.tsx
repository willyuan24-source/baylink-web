import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Heart } from 'lucide-react';
import { useSavedEntries, type SavedEntry } from '../lib/saves';
import { inWebCatalog, savedCoverImage, savedItemView, SAVED_KIND_LABELS, type SavedItemView } from '../lib/saved-items';
import { resolveCovers, type CoverPage, type ResolvedCover } from '../lib/cover';
import { eventDateChip, formatDateChip, offerDeadline } from '../lib/event-facts';
import { translateText, useLocale } from '../i18n/locale';
import { Button } from './ui/Button';
import { ChipRow, FilterChip } from './ui/Chip';
import { RowCard } from './ui/Card';
import { Cover } from './ui/Cover';
import { COVER_SIZES } from './ui/cover-sizes';
import { EmptyState, ErrorState } from './ui/States';
import { SkeletonFeed } from './ui/SkeletonCard';
import { EventTypeCover, OfferTypeCover, OpeningTypeCover, TypeCover } from './ui/TypeCover';
import { SaveHeart } from '../features/saves/SaveHeart';
import { usePostAvailability } from '../features/saves/post-availability';
import type { CoverTone } from '../lib/event-facts';

const KIND_ORDER: SavedEntry['kind'][] = ['event', 'offer', 'opening', 'place', 'guide', 'post'];
const KIND_TONES: Record<'place' | 'guide' | 'post', CoverTone> = { place: 'outdoors', guide: 'culture', post: 'family' };
/** "a · b · c" with each piece kept as its own node (a member's words keep their translate="no" span). */
const joinMeta = (pieces: ReactNode[]) => pieces.map((piece, index) => <Fragment key={index}>{index > 0 && ' · '}{piece}</Fragment>);

/** The 88px thumbnail: the item's own photo when the honesty ladder allows one, else its TypeCover. */
function Thumb({ view, cover, today, label, ended }: { view: SavedItemView; cover: ResolvedCover; today: string; label: string; ended?: boolean }) {
  const fallback = view.event ? <EventTypeCover event={view.event} today={today} size="mini" ariaHidden />
    : view.offer ? <OfferTypeCover offer={view.offer} today={today} size="mini" ariaHidden />
      : view.opening ? <OpeningTypeCover opening={view.opening} today={today} size="mini" ariaHidden />
        : <TypeCover tone={KIND_TONES[view.entry.kind as keyof typeof KIND_TONES] ?? 'family'} label={label} size="mini" ariaHidden />;
  return <Cover cover={cover} fallback={fallback} sizes={COVER_SIZES.thumb} decorative ended={ended} />;
}

/**
 * My Week's 收藏 block: every saved item of the one save model (src/lib/saves.ts) as a row with its cover, the same
 * list (and count) the /me tile names. Retired items stay listed with a remove button, so the count never drifts.
 * Saved neighbourhood listings on screen are checked against the live board: one its author deleted or hid says so
 * (and offers its ♡ to remove it) instead of linking to a dead page.
 */
export function UnifiedSavedItems({ today, signedIn, coverPage }: { today: string; signedIn: boolean; coverPage?: CoverPage }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const list = useSavedEntries();
  const [filter, setFilter] = useState<SavedEntry['kind'] | 'all'>('all');
  const views = useMemo(() => list.entries.map(savedItemView), [list.entries]);
  // RC-15: a save still waiting for the account whose item has left the web catalog is not sent again (it stays listed).
  const retiredPending = useMemo(() => new Set(views.filter(view => view.entry.source === 'pending' && !inWebCatalog(view)).map(view => view.entry.key)), [views]);
  const { retirePending } = list;
  useEffect(() => { retirePending(retiredPending); }, [retirePending, retiredPending]);
  const covers = useMemo(() => resolveCovers(views.map(view => view.cover ?? { kind: 'bulletin', id: view.entry.key }), { images: savedCoverImage, today, page: coverPage }), [views, today, coverPage]);
  const kinds = KIND_ORDER.filter(kind => views.some(view => view.entry.kind === kind));
  const active = filter !== 'all' && kinds.includes(filter) ? filter : 'all';
  const shown = views.map((view, index) => ({ view, cover: covers[index] })).filter(({ view }) => active === 'all' || view.entry.kind === active);
  const pick = (copy: { zh: string; en: string }) => t(copy.zh, copy.en);
  const unknown = list.count === null;
  const posts = usePostAvailability(shown.flatMap(({ view }) => view.entry.kind === 'post' ? [view.entry.id] : []));
  return <section id="saved" className="my-week__section" aria-labelledby="my-week-saved-title" data-testid="my-week-saved">
    <div className="my-week__head">
      <h2 id="my-week-saved-title"><Heart aria-hidden="true" strokeWidth={1.75} />{t('收藏', 'Saved')}{list.count !== 0 && <span className="my-week__count" data-testid="my-week-saved-count" aria-label={unknown ? t('账号收藏暂时未知', 'Account saved items unavailable') : undefined}>{unknown ? '—' : list.count}</span>}</h2>
    </div>
    <p className="my-week__note">{signedIn ? t('跟着账号走，换手机也能看到；邻里信息的收藏只留在这台设备。', 'Kept with your account on every device; saved neighborhood listings stay on this device.')
      : t('保存在这个浏览器，不用登录；登录后可以选择导入账号。', 'Kept in this browser without an account; sign in to choose whether to import them.')}</p>
    {list.status === 'error' && <ErrorState headingLevel="h3" homeTo={null} onRetry={list.retry} title={t('暂时读不到账号收藏', 'Your saved items didn’t load')}
      body={list.entries.length ? t('下面是这台设备上的收藏。网络恢复后点重试。', 'Items saved on this device are below. Try again when you are back online.') : t('可能是网络不稳或服务繁忙。已保存的内容不会因此消失。', 'The connection or our service may be busy. Nothing you saved is lost.')} />}
    {list.status === 'loading' && !list.entries.length && <SkeletonFeed rows count={3} />}
    {!unknown && !list.entries.length && <EmptyState headingLevel="h3" icon={Heart} title={t('还没有收藏', 'Nothing saved yet')}
      body={t('看到想去的活动、想用的优惠，点 ♡ 收藏，就会出现在这里。', 'Tap ♡ on an event or offer you like and it shows up here.')}
      actions={<Button variant="primary" to="/events">{t('看本周末活动', 'See this weekend’s events')}</Button>} />}
    {kinds.length > 1 && <ChipRow label={t('按类型筛选收藏', 'Filter saved items by type')} className="my-week__filters">
      <FilterChip selected={active === 'all'} count={views.length} onClick={() => setFilter('all')}>{t('全部', 'All')}</FilterChip>
      {kinds.map(kind => <FilterChip key={kind} selected={active === kind} count={views.filter(view => view.entry.kind === kind).length} onClick={() => setFilter(kind)}>{pick(SAVED_KIND_LABELS[kind])}</FilterChip>)}
    </ChipRow>}
    {shown.length > 0 && <ul className="my-week__list">{shown.map(({ view, cover }) => {
      const title = view.userText ? view.title : translateText(view.title, locale);
      const kind = pick(view.kindLabel);
      const availability = view.entry.kind === 'post' ? posts.get(view.entry.id) : undefined;
      // Each piece is translated on its own (the dictionaries hold the pieces, not the joined line); a member's own
      // words (a listing's city and budget) are shown as written.
      const meta = joinMeta([kind, ...view.meta.map(part => translateText(part, locale)), ...(view.userMeta ?? []).map(part => <span translate="no">{part}</span>),
        view.entry.source === 'pending' ? t('本机，稍后同步到账号', 'on this device, syncing to your account') : '',
        availability === 'unknown' ? t('暂时无法检查是否仍在', 'could not check whether it is still listed') : ''].filter(Boolean));
      const chip = view.event ? eventDateChip(view.event, today) : undefined;
      const ended = chip?.kind === 'day' && chip.ended;
      const date = chip ? `${ended ? `${t('已结束', 'Ended')} · ` : ''}${formatDateChip(chip, english).label}` : view.offer ? (() => { const deadline = offerDeadline(view.offer!, today); return deadline ? pick(deadline.text) : undefined; })() : undefined;
      const heart = <SaveHeart kind={view.entry.kind} id={view.entry.id} title={title} post={view.entry.post} />;
      return <li key={view.entry.key} data-kind={view.entry.kind} data-ended={ended ? '' : undefined}>
        {availability === 'gone' ? <div className="my-week__retired" data-testid="saved-post-gone"><p><strong translate={view.userText ? 'no' : undefined}>{title}</strong> · {t('这条信息目前不可访问，可以移除收藏。', 'This listing is no longer available. You can remove it.')}</p>{heart}</div>
          : view.path ? <RowCard title={title} rawTitle={view.userText} to={view.path} thumb={<Thumb view={view} cover={cover} today={today} label={kind} ended={ended} />} date={date} meta={meta} trailing={heart} />
          : <div className="my-week__retired"><p><strong>{kind}</strong> · {t('这条内容已下架或暂时找不到。', 'This item is no longer listed.')}</p>{heart}</div>}
      </li>;
    })}</ul>}
    {!list.persisted && <p className="my-week__note" role="status">{t('浏览器未允许保存最近的改动，刷新后可能恢复原样。', 'Your browser did not keep the latest change; it may revert after a refresh.')}</p>}
  </section>;
}
