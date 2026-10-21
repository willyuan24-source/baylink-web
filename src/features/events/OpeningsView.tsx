import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, CoverCredit, EmptyState, FeedGrid, FeedItem, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { coverItemFor, createCoverPage, resolveCovers } from '../../lib/cover';
import { INDEX_OPENINGS, coverContext, filterOpenings } from './events-model';
import type { IndexOpening, MonthlyRegion } from './events-index-types';
import { OpeningFeedCard } from './BoardCards';
import { openingSections, type OpeningSectionId } from './board-status';
import { ImageCredits } from './ImageCredits';
import { RegionFilter } from './RegionFilter';
import { useBoardMode, useSetRegion } from './board-mode';
import './boards.css';

/** "再看 N 家" adds this many to a section. */
const MORE = 12;
const OPENINGS_GUIDE = '/guides/bay-area-new-openings-2026-09';
const NO_EXTRA: Readonly<Record<OpeningSectionId, number>> = { open: 0, soon: 0 };

/**
 * 新店 (content arrangement 10-19): the region chip and the one honesty line, then two sections — 已开业 (open and
 * soft-open shops, the newest dated first day first: Marufuku 10/11) and 即将开业 (the nearest announced day first) — which
 * replace the old status chips. Cards: the shop's image or C's shopfront (1:1), line 1 the openingChip status, line 2 city ·
 * what it sells, the source line (媒体报道 for a press source). On a phone at 大 / 特大 / 简洁 the cards are rows.
 */
export default function OpeningsView({ today, region }: { today: string; region: MonthlyRegion | 'all' }) {
  const { t, pick } = useUiCopy();
  const [extra, setExtra] = useState<Readonly<Record<OpeningSectionId, number>>>(NO_EXTRA);
  const { layout } = useFeedLayout();
  const mode = useBoardMode();
  const setRegion = useSetRegion();
  const openings = useMemo(() => filterOpenings(INDEX_OPENINGS, 'all', region), [region]);
  const sections = useMemo(() => openingSections(openings, today), [openings, today]);
  // 已开业: phone 6, desktop 8; 即将开业: 4; 简洁 3 each, 家人版 2 (board-mode.ts simpleSize).
  const firstSize = (id: OpeningSectionId) => mode.simple ? mode.simpleSize : id === 'open' ? mode.phone ? 6 : 8 : 4;
  const shown = sections.map(section => section.openings.slice(0, firstSize(section.id) + extra[section.id]));
  const shownKey = shown.map(list => list.map(shop => shop.id).join()).join('|');
  const covers = useMemo(() => {
    const flat = shown.flat();
    const resolved = resolveCovers(flat.map(shop => coverItemFor('opening', shop)), { ...coverContext(today), page: createCoverPage() });
    return new Map(flat.map((shop, index) => [shop.id, resolved[index]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the ids shown
  }, [shownKey, today]);
  const count = (n: number) => t(`${n} 家`, `${n} ${n === 1 ? 'shop' : 'shops'}`);
  const card = (shop: IndexOpening) => <OpeningFeedCard opening={shop} cover={covers.get(shop.id)!} today={today} row={mode.rows} simple={mode.simple} />;
  return <div className="fb-board">
    <div className="fb-filters">
      <RegionFilter region={region} status={t(`显示 ${openings.length} 家`, `Show ${openings.length}`)} />
      <p className="fb-note">{t('整理自公开资料，未实地探店', 'From public sources, not visited in person')}</p>
    </div>
    {sections.length ? <div className="fb-sections">{sections.map((section, index) => {
      const more = Math.min(MORE, section.openings.length - shown[index].length);
      const head = `fb-openings-${section.id}`;
      return <section key={section.id} className="fb-section" aria-labelledby={head}>
        <h2 id={head} className="fb-section__head">{pick(section.label)}<span className="fb-section__count"> · {count(section.openings.length)}</span></h2>
        {mode.rows
          ? <ul className="fb-rows" aria-label={pick(section.label)}>{shown[index].map(shop => <li key={shop.id}>{card(shop)}</li>)}</ul>
          : <FeedGrid label={pick(section.label)} ratio="1:1" layout={layout}>{shown[index].map(shop => <FeedItem key={shop.id}>{card(shop)}</FeedItem>)}</FeedGrid>}
        {more > 0 && <div className="ev-more"><Button variant="secondary" block onClick={() => setExtra(previous => ({ ...previous, [section.id]: previous[section.id] + MORE }))}>{t(`再看 ${more} 家`, `Show ${more} more`)}</Button></div>}
      </section>;
    })}</div> : <EmptyState headingLevel="h3" title={t('这个地区暂时没有新店', 'No new shops here yet')} body={t('换个地区再看看。', 'Try another region.')}
      actions={<Button variant="primary" onClick={() => setRegion('all')}>{t(`看整个湾区的新店（${INDEX_OPENINGS.length}）`, `Show the whole Bay Area (${INDEX_OPENINGS.length})`)}</Button>} />}
    {/* The coded-cover note once for the board (see PerksView). */}
    {[...covers.values()].some(cover => cover.tier === 'type') && <CoverCredit />}
    <nav className="ev-end" aria-label={t('新店指南', 'New shop guide')}>
      <Link className="ev-end__item" to={OPENINGS_GUIDE}>{t('新店手册：去之前先确认开门', 'New shop guide: check they are open first')}</Link>
    </nav>
    <ImageCredits covers={[...covers.values()]} />
  </div>;
}
