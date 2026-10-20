import { useState } from 'react';
import { ChevronLeft, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sheet } from '../../components/ui/Sheet';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SegmentedTitle } from '../../components/SegmentedTitle';
import type { Guide } from '../../data/guides';
import { guideTopicOf } from '../../data/guide-topics';
import { translateText } from '../../i18n/locale';
import { editionCoverageLabel } from '../../lib/edition-label';
import { guideEnglishDate, guideReadMinutes, guideSourceCount, splitGuideTitle, topicCopy } from './guide-facts';

/**
 * The article head (design.md §4.10, GUIDE-03; UI9-GUIDES content arrangement): breadcrumb → H1 (the short part at title size,
 * the rest of the SEO title as a quieter line inside the same heading) → two meta lines: "[2026 年 10 月本期 · ]内容更新 10-16 ·
 * 约 4 分钟" and "官方来源 10 个 ⓘ". Each item keeps its words together (nowrap) and each "·" belongs to the item after it,
 * so a wrapped line never starts with a dot. The ⓘ opens a sheet with what the date means. 家人版 drops the subtitle and the
 * second line (guide-article.css).
 */
export function GuideHeader({ guide, returnTo, today }: { guide: Guide; returnTo: string; today?: string }) {
  const { t, pick, locale, english } = useUiCopy();
  const [aboutOpen, setAboutOpen] = useState(false);
  const topic = guideTopicOf(guide);
  const { head, separator, rest } = splitGuideTitle(translateText(guide.title, locale));
  const sources = guideSourceCount(guide);
  const minutes = guideReadMinutes(guide);
  // G26: a guide built around a deals board is browsed, not read through; a reading time from its prose alone would
  // promise minutes for a list of a hundred cards, so its meta says what it is instead.
  const board = guide.blocks.some(block => block.type === 'freebies');
  // A current monthly edition opens the first meta line ("2026 年 10 月本期"); a past one keeps its notice in the lead.
  const current = !!guide.editionMonth && !!today && (guide.editionThroughDate ? today <= guide.editionThroughDate : today.slice(0, 7) <= guide.editionMonth)
    && (!guide.editionStartDate || today >= guide.editionStartDate);
  const edition = current ? editionCoverageLabel({ editionMonth: guide.editionMonth!, editionStartDate: guide.editionStartDate, editionThroughDate: guide.editionThroughDate }, locale) : '';
  return <header className="gd-header">
    <nav className="gd-crumbs" aria-label={t('当前位置', 'Breadcrumb')}>
      <Link to={returnTo}><ChevronLeft aria-hidden="true" strokeWidth={1.75} />{t('指南', 'Guides')}</Link>
      <span aria-hidden="true">/</span>
      <Link to={`/guides?topic=${topic}`}>{pick(topicCopy(topic))}</Link>
    </nav>
    <h1 className="gd-title" lang={english ? 'en' : undefined}>
      <span className="gd-title__head"><SegmentedTitle text={head} /></span>
      {/* The separator stays in the heading's text (accessible name, SEO) but is not drawn: the rest sits on its own line. */}
      {rest && <><span className="gd-title__sep">{separator}</span><span className="gd-title__rest">{english ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest}</span></>}
    </h1>
    <p className="gd-meta">
      {edition && <span className="gd-meta__item" data-edition="">{t(`${edition}本期`, `${edition} edition`)}</span>}
      <span className="gd-meta__item">{t(`内容更新 ${guide.updatedAt}`, `Updated ${guideEnglishDate(guide.updatedAt)}`)}</span>
      <span className="gd-meta__item">{board ? t('优惠清单 · 可按条件筛选', 'Deals list · filter by condition') : t(`约 ${minutes} 分钟`, `${minutes} min read`)}</span>
    </p>
    <p className="gd-meta gd-meta--sources">
      {sources > 0 ? <a className="gd-meta__item" href="#guide-sources">{t(`官方来源 ${sources} 个`, `${sources} official source${sources === 1 ? '' : 's'}`)}</a>
        : <span className="gd-meta__item">{t('BAYLINK 整理', 'Compiled by BAYLINK')}</span>}
      <button type="button" className="gd-meta__info" aria-haspopup="dialog" aria-label={t('关于日期与来源', 'About dates and sources')} onClick={() => setAboutOpen(true)}><Info aria-hidden="true" strokeWidth={1.75} /></button>
    </p>
    <Sheet open={aboutOpen} onClose={() => setAboutOpen(false)} title={t('关于日期与来源', 'About dates and sources')}>
      <div className="gd-about">
        <p>{t('“内容更新”是这篇指南内容的整理日期，不代表每个官方来源都在当天重新核验。', 'The “updated” date is when this guide’s content was revised, not a re-check of every official source on that day.')}</p>
        {guide.sourceNote && <p>{guide.sourceNote}</p>}
        {sources > 0 && <p><a href="#guide-sources" onClick={() => setAboutOpen(false)}>{sources === 1 ? t('查看 1 个官方来源', 'See the official source') : t(`查看 ${sources} 个官方来源`, `See the ${sources} official sources`)}</a></p>}
        <p><Link to="/about#about-method-title">{t("我们怎么核对", "How we check")}</Link></p>
      </div>
    </Sheet>
  </header>;
}
