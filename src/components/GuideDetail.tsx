import { PerksGallery } from './PerksGallery';
import { EnglishOnly } from './EnglishOnly';
import { Fragment, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Lightbulb,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { GuideBlock } from "../data/guides";
import type { GuideImage } from '../data/guide-media';
import { guideTopicOf } from '../data/guide-topics';
import { OutingInspirationLink } from './OutingInspirationLink';
import { GuideFigure, GuideRouteRenderer } from './GuideVisuals';
import { GuideEditionNotice } from './GuideEditionNotice';
import { translateText } from '../i18n/locale';
import { UtilityDirectory, UtilityContactDirectory } from './UtilityDirectory';
import { ShoppingDirectory } from './ShoppingDirectory';
import { UsefulPlatformsDirectory } from './UsefulPlatformsDirectory';
import { GuidePhoneText as PhoneText, linkifyGuidePhones, PlainPhonesProvider, usePlainPhones } from '../features/guides/plain-phones';
import { useSimpleDisplay } from '../lib/reading-preferences';
import { GuidePhoneDirectoryOr } from '../features/guides/GuidePhoneDirectory';
import { createCoverPage, type CoverPage } from '../lib/cover';
import { useBayAreaToday } from '../lib/useBayAreaToday';
import { useUiCopy } from './ui/ui-copy';
import { SegmentedTitle } from './SegmentedTitle';
import { CoverImage } from './ui/CoverImage';
import { COVER_SIZES } from './ui/cover-sizes';
import { FeedGrid, FeedItem } from './ui/FeedGrid';
import { FeedCard, RowCard } from './ui/Card';
import { Button } from './ui/Button';
import { Disclosure } from './ui/Disclosure';
import type { EditorialCopy, GuideEditorial } from '../data/guide-editorial';
import { GuideHeader } from '../features/guides/GuideHeader';
import { GuideActions, type GuideAsk } from '../features/guides/GuideActions';
import { GuideCarousel } from '../features/guides/GuideCarousel';
import { ContactCards, KeyFactsCard } from '../features/guides/GuideFactCards';
import { quickFactsEligible } from '../features/guides/guide-kind';
import { GuideDiagramFigure } from '../features/guides/GuideDiagram';
import { GuideCover, guideCaption } from '../features/guides/GuideCover';
import { DeferredGuideTypeCover } from './ui/cover-defer';
import { handleGuideLinkClick } from '../features/guides/guide-link';
import { GuideCoverCredit, GuidePageImageCredits, GuideToTop } from '../features/guides/GuidePageParts';
import { editionState, guideCallOf, guideCardLines, guideCover, guideEnglishDate, guideSourceCount, topicCopy } from '../features/guides/guide-facts';
import { relatedForToday, type GuideCard, type GuideRecord } from '../features/guides/guide-records';
import { peekGuide } from '../features/guides/guide-store';
import { CityExplorationBlock, FreebieBoardBlock, GuideOpusBlock, QuickFactsBlock } from '../features/guides/guide-blocks';
import { LazyReportErrorLink } from '../features/feedback/LazyEntryLinks';
import '../features/guides/guide-article.css';

type GuideDetailProps = {
  slug: string;
  /** The guide's generated record (guide-store.ts); read from the store when absent. The page loads it before rendering. */
  record?: GuideRecord;
  returnTo?: string;
  today?: string;
  /** Kept for callers; the breadcrumb's "‹ 指南" link returns to `returnTo`. */
  onBack?: () => void;
  onOpenGuide: (slug: string) => void;
  onNavigate: (path: string) => void;
  onAsk?: GuideAsk;
  onOpenPost: (options: {
    type: "client" | "provider";
    categorySlug: string;
  }) => void;
};

export const GuideDetail = (props: GuideDetailProps) => <GuideDetailSession key={props.slug} {...props} />;

const FREEBIE_GALLERIES: Record<string, 'birthday' | 'everyday' | 'retail' | undefined> = {
  'bay-area-birthday-perks': 'birthday', 'bay-area-everyday-free-perks': 'everyday', 'bay-area-retail-freebies-family-deals': 'retail', 'bay-area-freebies-deals-2026-10': undefined,
};

/**
 * 接下来 (UI9-GUIDES): related guides, resolved on the article's cover page so no image repeats. Desktop: four covers across the
 * frame (3:2, the crop home's guide grid uses). Phone and tablet: three rows (a mini cover, the full title, the two meta
 * lines). 简洁显示: one link to the guide's topic instead (data-simple).
 */
function RelatedGuides({ related, coverPage, today, topic, onOpenGuide }: { related: GuideCard[]; coverPage: CoverPage; today: string; topic: ReturnType<typeof guideTopicOf>; onOpenGuide: (slug: string) => void }) {
  const { t, pick, english, locale } = useUiCopy();
  const covers = related.map(guide => guideCover(guide, today, coverPage));
  const open = (slug: string) => (event?: MouseEvent<HTMLAnchorElement>) => event ? handleGuideLinkClick(event, () => onOpenGuide(slug)) : onOpenGuide(slug);
  const lines = related.map(guide => guideCardLines(guide, today));
  return <section className="bl-guide-related gd-related" aria-labelledby="gd-related-title">
    <div className="gd-related__head">
      <h2 id="gd-related-title">{t('接下来，你可能想看', 'Read next')}</h2>
      <Link to="/guides">{t('全部指南', 'All guides')}</Link>
    </div>
    <ul className="gd-related__rows" data-simple="hide" aria-label={t('相关指南', 'Related guides')}>{related.slice(0, 3).map((guide, index) => <li key={guide.slug}>
      <RowCard title={translateText(guide.title, locale)} titleLang={english ? 'en' : undefined} to={`/guides/${guide.slug}`} onOpen={open(guide.slug)}
        thumb={<GuideCover guide={guide} cover={covers[index]} ratio="1:1" mini sizes={COVER_SIZES.thumb} />}
        when={pick(lines[index].when)} meta={lines[index].meta && pick(lines[index].meta)} />
    </li>)}</ul>
    <div className="gd-related__grid" data-simple="hide"><FeedGrid label={t('相关指南', 'Related guides')}>{related.map((guide, index) => <FeedItem key={guide.slug}>
      <FeedCard title={translateText(guide.title, locale)} titleShown={guideCaption(guide, locale, covers[index])} titleLang={english ? 'en' : undefined} heading="h3" to={`/guides/${guide.slug}`} onOpen={open(guide.slug)}
        cover={<GuideCover guide={guide} cover={covers[index]} ratio="3:2" sizes={COVER_SIZES.feed} />}
        when={pick(lines[index].when)} meta={lines[index].meta && pick(lines[index].meta)} />
    </FeedItem>)}</FeedGrid></div>
    <p className="gd-related__topic" data-simple="show"><Link to={`/guides?topic=${topic}`}>{t(`更多「${pick(topicCopy(topic))}」指南`, `More ${pick(topicCopy(topic))} guides`)}<ChevronRight aria-hidden="true" strokeWidth={1.75} /></Link></p>
  </section>;
}

/** A pilot guide's H2 as a step card: a numeral, the original heading (anchor kept) and a one-line conclusion; the original
 * prose and its links fold under "展开原文与来源" (design.md §4.10). Without a conclusion the prose stays open. */
function StepSection({ number, heading, id, conclusion, figures, children }: { number: number; heading: string; id: string; conclusion?: EditorialCopy; figures?: ReactNode; children: ReactNode }) {
  const { t, pick } = useUiCopy();
  const except = usePlainPhones();
  return <section className="gd-step" aria-labelledby={id}>
    <div className="gd-step__head">
      <span className="gd-step__number" aria-hidden="true">{number}</span>
      <div><h2 id={id}><SegmentedTitle text={heading} /></h2>{conclusion && <p className="gd-step__conclusion">{linkifyGuidePhones(pick(conclusion), { except })}</p>}</div>
    </div>
    {/* H22: the step's diagram stays outside the fold, under its conclusion. */}
    {figures}
    {conclusion ? <Disclosure className="gd-step__more" summary={t('展开原文与来源', 'Full text and sources')}><div className="bl-guide-prose">{children}</div></Disclosure>
      : <div className="bl-guide-prose">{children}</div>}
  </section>;
}

const GuideDetailSession = ({
  slug,
  record: suppliedRecord,
  returnTo = '/guides',
  today: suppliedToday,
  onOpenGuide,
  onNavigate,
  onAsk,
  onOpenPost,
}: GuideDetailProps) => {
  const record = suppliedRecord ?? peekGuide(slug);
  const guide = record?.guide;
  const { t, english } = useUiCopy();
  const today = useBayAreaToday(suppliedToday);
  const editorial: GuideEditorial | undefined = record?.editorial;
  // 简洁显示: each number keeps two tap targets, the bar's 拨打 and its contact's; its other copies print as text.
  const simple = useSimpleDisplay();
  const plainPhones = useMemo(() => {
    if (!simple || !editorial) return undefined;
    const call = guideCallOf(editorial);
    return new Set([...(call ? [call.tel] : []), ...(editorial.contacts ?? []).map(contact => contact.tel)]);
  }, [simple, editorial]);
  const page = useMemo(() => {
    if (!record) return null;
    const { guide } = record;
    const coverPage = createCoverPage();
    const cover = guideCover({ slug: guide.slug, covers: record.covers }, today, coverPage);
    // Rule 6, one picture once per page: the deals board shows each offer's own picture, so the article drops an inline
    // picture the board already shows; the legacy poster opens only when it is not the cover; and every picture shown
    // claims its place before the related guides resolve, so their covers fall back to a TypeCover instead of repeating it.
    // The record's inline pictures already passed keepInlineImage (guide-data.ts) and its board pictures are getOfferImage's.
    const boardImages = record.boardImages ?? [];
    const sectionCount = guide.blocks.filter(block => block.type === 'heading').length;
    const inline = record.inline.filter(item => Number.isInteger(item.afterHeading) && item.afterHeading >= 1 && item.afterHeading <= sectionCount
      && !boardImages.includes(item.image.src));
    const poster = guide.cover && !coverPage.claims.has(guide.cover) && !inline.some(item => item.image.src === guide.cover) ? guide.cover : undefined;
    for (const src of [...inline.map(item => item.image.src), ...boardImages, ...(poster ? [poster] : [])]) if (!coverPage.claims.has(src)) coverPage.claims.set(src, `page:${guide.slug}`);
    // The 3D link's postcard (H36) shows only when the page does not already show it, and then claims it like the others.
    const opusArt = !!record.opus?.postcard && !coverPage.claims.has(record.opus.postcard.src);
    if (opusArt) coverPage.claims.set(record.opus!.postcard!.src, `page:${guide.slug}`);
    // H08: a guide without an editorial record gets a 30 秒看懂 built from its own sentences (none for outings and directories;
    // QuickFactsBlock, loaded with the record of those guides only).
    const quickFacts = quickFactsEligible(guide, !!record.editorial);
    // "Read next" never offers an edition past its last day (editionState; relatedForToday keeps the runtime month rule).
    return { coverPage, cover, inline, poster, opusArt, quickFacts, related: relatedForToday(record.related.filter(card => editionState(card, today) !== 'past'), today) };
  }, [record, today]);

  if (!guide || !page)
    return (
      <div className="bl-guide-empty">
        <BookOpen size={30} aria-hidden="true" />
        <h1>未找到该指南</h1>
        <p>链接可能已失效或文章已移除</p>
        <Button variant="primary" onClick={() => onNavigate("/guides")}>返回湾区指南</Button>
      </div>
    );
  const { cover, related, coverPage } = page;
  // Only guides without source marks fold their list (a pilot's ①–⑬ must always land on a visible source).
  const sourcesShown = !editorial && guide.sources.length >= SOURCES_FOLD_AT ? SOURCES_SHOWN : guide.sources.length;
  const prefaceLength = Math.max(0, guide.blocks.findIndex(block => block.type === 'freebies'));
  const board = guide.blocks.some(block => block.type === 'freebies');
  const headingIndexes = guide.blocks.flatMap((block, index) => block.type === 'heading' ? [index] : []);
  const inlineAfter = new Map<number, GuideImage[]>();
  for (const item of page.inline) {
    const lastBlock = (headingIndexes[item.afterHeading] ?? guide.blocks.length) - 1;
    inlineAfter.set(lastBlock, [...(inlineAfter.get(lastBlock) || []), item.image]);
  }
  const shownImages = [...(cover.tier !== 'type' ? [cover.image] : []), ...page.inline.map(item => item.image)];
  const headings = guide.blocks.flatMap((block, index) =>
    block.type === "heading"
      ? [{ text: block.text, id: `guide-section-${index}` }]
      : [],
  );
  const handleCta = (block: Extract<GuideBlock, { type: "cta" }>) => {
    if (block.primaryAction === "post" && block.postCategorySlug)
      onOpenPost({
        type: block.postType || "client",
        categorySlug: block.postCategorySlug,
      });
    else if (block.primaryAction === "category" && block.categorySlug)
      onNavigate(`/category/${block.categorySlug}`);
    else if (block.primaryAction === "guides") onNavigate("/guides");
  };
  const renderBlock = (block: GuideBlock, index: number, pictures = true) => (
    <Fragment key={`${slug}-${index}`}>
      <BlockRenderer block={block} id={`guide-section-${index}`} onCta={handleCta} />
      {pictures && inlineAfter.get(index)?.map(image => <GuideFigure key={image.src} image={image} />)}
    </Fragment>
  );
  // H22: the pilot guides' diagrams (record.diagrams): `lead` ones after 联系电话, numbered ones inside that step card.
  const diagramsAt = (at: 'lead' | number) => {
    const placed = (record?.diagrams ?? []).filter(item => item.at === at);
    return placed.length ? placed.map((item, index) => <GuideDiagramFigure key={`${at}-${index}`} guide={guide} diagram={item.diagram} />) : null;
  };
  const leadDiagrams = diagramsAt('lead');
  // Pilot guides: each H2 and the blocks under it become one step card.
  const bodyBlocks = guide.blocks.map((block, index) => ({ block, index })).filter(({ index }) => index >= prefaceLength);
  const stepHeadings = headingIndexes.filter(index => index >= prefaceLength);
  const body = !editorial?.steps ? <div className="bl-guide-prose">{bodyBlocks.map(({ block, index }) => renderBlock(block, index))}</div> : <>
    {bodyBlocks.some(({ index }) => !stepHeadings.length || index < stepHeadings[0]) && <div className="bl-guide-prose">{bodyBlocks.filter(({ index }) => !stepHeadings.length || index < stepHeadings[0]).map(({ block, index }) => renderBlock(block, index))}</div>}
    {stepHeadings.map((headingIndex, order) => {
      const next = stepHeadings[order + 1] ?? guide.blocks.length;
      const heading = guide.blocks[headingIndex] as Extract<GuideBlock, { type: 'heading' }>;
      // H22 (CNT-MEDIA-4): the step's pictures stand with its diagram outside the fold, not inside 展开原文与来源.
      const pictures = bodyBlocks.filter(({ index }) => index >= headingIndex && index < next).flatMap(({ index }) => inlineAfter.get(index) ?? []);
      const diagrams = diagramsAt(order + 1);
      return <StepSection key={headingIndex} number={order + 1} heading={heading.text} id={`guide-section-${headingIndex}`} conclusion={editorial.steps?.[headingIndexes.indexOf(headingIndex)]}
        figures={diagrams || pictures.length ? <>{diagrams}{pictures.map(image => <GuideFigure key={image.src} image={image} />)}</> : null}>
        {bodyBlocks.filter(({ index }) => index > headingIndex && index < next).map(({ block, index }) => renderBlock(block, index, false))}
      </StepSection>;
    })}
  </>;
  // 目录: 联系电话 · the boards · each step · 官方来源 (UI9-GUIDES content arrangement).
  const contents = (
    <ol className="gd-toc__list">
      {editorial?.contacts && <li><a href="#gd-contacts-title"><span aria-hidden="true">☎</span>{t('联系电话', 'Who to call')}</a></li>}
      {guide.blocks.filter(block => block.type === 'freebies').map((block, index) => <li key={`freebies-${index}`}><a href={`#freebie-board-${index}`}><span aria-hidden="true">🎁</span>{block.title}</a></li>)}
      {headings.map((heading, index) => (
        <li key={heading.id}>
          <a href={`#${heading.id}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {heading.text}
          </a>
        </li>
      ))}
      <li>
        <a href="#guide-sources">
          <span aria-hidden="true">
            <ChevronRight aria-hidden="true" strokeWidth={1.75} />
          </span>
          {t('官方来源', 'Official sources')}
        </a>
      </li>
    </ol>
  );
  const visual = editorial ? <GuideCarousel guide={guide} editorial={editorial} />
    : cover.tier !== 'type' ? <figure className="gd-cover-figure"><CoverImage className="gd-cover" image={cover.image} label={english ? cover.label.en : translateText(cover.label.zh)} fit={cover.fit} focal={cover.focal} ratio="3:2" sizes={COVER_SIZES.detail} priority />
      {!cover.image.scene3d && <GuideCoverCredit image={cover.image} />}</figure> : null;
  // The bar's primary: 拨打 the guide's number, else its first official source (官方入口 ↗).
  const call = guideCallOf(editorial);
  const official = guide.sources[0];
  const sources = guideSourceCount(guide);
  const archivedEdition = editionState(guide, today) === 'past';

  return (
    <PlainPhonesProvider value={plainPhones}>
    <div className="bl-guide-detail gd-page" data-pilot={editorial ? '' : undefined} data-board={board ? '' : undefined}>
      <article className="bl-guide-article gd-article">
        <GuideHeader guide={guide} returnTo={returnTo} today={today} />
        <div className="gd-lead" data-visual={visual ? '' : undefined}>
          {visual && <div className="gd-lead__visual">{visual}</div>}
          <div className="gd-lead__side">
            {board && <a className="bl-freebie-jump" href="#freebie-board-0">看免费领取图鉴<ArrowDownRight size={17} aria-hidden="true" /></a>}
            {/* A current edition says so in the head's meta line; a past one keeps its full notice above the body. */}
            {guide.editionMonth && archivedEdition && <GuideEditionNotice offers={guide.slug.startsWith('bay-area-freebies-deals-') || board} editionMonth={guide.editionMonth} startDate={guide.editionStartDate} throughDate={guide.editionThroughDate} checkedAt={guide.updatedAt} today={today} />}
            {/* H08: without an editorial record, the fallback 30 秒看懂 comes first (answer first), then the summary. */}
            {!editorial && page.quickFacts && <QuickFactsBlock guide={guide} today={today} />}
            {editorial ? <KeyFactsCard guide={guide} facts={editorial.keyFacts} />
              : <div className="gd-summary"><p>{guide.summary}</p>{guide.audience.length > 0 && <p className="gd-summary__audience"><span>{t('适合：', 'For: ')}</span>{guide.audience.map((audience, index) => <Fragment key={audience}>{index > 0 && '、'}<span>{audience}</span></Fragment>)}</p>}</div>}
          </div>
        </div>
        {/* The rail (desktop columns 10–12, sticky to the end of the sources): the bar's card and the 官方来源 link. On a phone
            the bar is fixed at the bottom and the link stays in the head's meta line. */}
        <aside className="gd-rail" aria-label={t('侧栏', 'Page tools')}>
          <div className="gd-rail__inner">
            <GuideActions guide={guide} call={call} official={official} onAsk={onAsk} />
            {sources > 0 && <a className="gd-rail__sources" href="#guide-sources">{t(`官方来源 ${sources} 个`, `${sources} official source${sources === 1 ? '' : 's'}`)}<ArrowDownRight aria-hidden="true" strokeWidth={1.75} /></a>}
          </div>
        </aside>
        {record?.opus && <GuideOpusBlock entry={record.opus} showArt={page.opusArt} />}
        {board && <div className="gd-boards">
          {prefaceLength > 0 && <div className="bl-guide-prose">{guide.blocks.slice(0, prefaceLength).map((block, index) => renderBlock(block, index))}</div>}
          {guide.slug in FREEBIE_GALLERIES && <PerksGallery topic={FREEBIE_GALLERIES[guide.slug]} />}
          {guide.blocks.filter(block => block.type === 'freebies').map((block, index) => <div id={`freebie-board-${index}`} key={index}><FreebieBoardBlock offers={block.offers} title={block.title} description={block.text} today={today} skipImages={!editorial && cover.tier !== 'type' ? [cover.image.src] : []} /></div>)}
        </div>}
        <nav className="bl-guide-toc gd-toc" aria-label={t('文章目录', 'Contents')}>
          <Disclosure className="gd-toc__phone" summary={<>{t('目录', 'Contents')}<span className="gd-toc__count">{t(`${headings.length} 个章节`, `${headings.length} section${headings.length === 1 ? '' : 's'}`)}</span></>}>{contents}</Disclosure>
          <div className="gd-toc__desk"><h2>{t('目录', 'Contents')}</h2>{contents}</div>
        </nav>
        {editorial?.contacts && <ContactCards guide={guide} contacts={editorial.contacts} />}
        {leadDiagrams && <div className="gd-lead-diagrams">{leadDiagrams}</div>}
        <div className="bl-guide-reading-main gd-main">
          {page.poster && (
            <Disclosure className="guide-poster-disclosure" summary="查看原版图文海报">
              <GuideFigure variant="poster" image={{ src: page.poster, alt: `${guide.title} 原版图文海报`, caption: '原版图文海报作为补充阅读，最新整理请以本文正文及官方资料为准。', credit: 'BAYLINK 原有指南附图', kind: 'illustration', width: 1055, height: 1491 }} />
            </Disclosure>
          )}
          {body}
          {(guide.category === 'city' || guide.category === 'events') && <OutingInspirationLink kind="guide" id={guide.slug} />}
          <section
            className="bl-guide-sources gd-sources"
            aria-labelledby="guide-sources"
          >
            <h2 id="guide-sources">{t('官方来源', 'Official sources')}</h2>
            {/* H13: the page's one template caution (data-template-note): the hedging lint and probes do not count it as the
                article's own wording (tests/guide-hedging.test.tsx). */}
            <p data-template-note="">
              按你的具体情况核对原始资料。票价、开放时间、法规和服务安排可能变化。
            </p>
            {/* H66: a long source list (a deals board cites one page per offer: 180+ on the October board, 33 phone screens)
                shows its first SOURCES_SHOWN and folds the rest under 看全部 N 个来源; pilot guides keep the whole list. */}
            <ul>{guide.sources.slice(0, sourcesShown).map((source, index) => <SourceItem key={source.url} source={source} index={index} />)}</ul>
            {guide.sources.length > sourcesShown && <Disclosure className="gd-sources-more" summary={t(`看全部 ${guide.sources.length} 个官方来源`, `All ${guide.sources.length} official sources`)}>
              <ul>{guide.sources.slice(sourcesShown).map((source, index) => <SourceItem key={source.url} source={source} index={sourcesShown + index} />)}</ul>
            </Disclosure>}
            <p className="gd-sources__date">{t(`内容更新 ${guide.updatedAt}`, `Content updated ${guideEnglishDate(guide.updatedAt)}`)}</p>
            <LazyReportErrorLink key={`report-guide-${slug}`} className="feedback-report-row--guide" entity={{ kind: 'guide', id: slug }} title={guide.title} />
          </section>
          {guide.sourceNote && (
            <p className="bl-guide-source-note">{guide.sourceNote}</p>
          )}
        </div>
        {related.length > 0 && <RelatedGuides related={related} coverPage={coverPage} today={today} topic={guideTopicOf(guide)} onOpenGuide={onOpenGuide} />}
        <GuidePageImageCredits images={shownImages} />
        <Button variant="quiet" to={returnTo} className="bl-guide-return" icon={<ArrowLeft aria-hidden="true" strokeWidth={1.75} />}>
          {t('返回湾区指南', 'Back to guides')}
        </Button>
      </article>
      <GuideToTop />
    </div>
    </PlainPhonesProvider>
  );
};

/** A source list this long folds after SOURCES_SHOWN (H66), on guides without an editorial record. */
const SOURCES_FOLD_AT = 14;
const SOURCES_SHOWN = 8;

function SourceItem({ source, index }: { source: { title: string; url: string; description: string }; index: number }) {
  return <li id={`guide-source-${index + 1}`}>
    <a href={source.url} target="_blank" rel="noopener noreferrer">
      {source.title}
      <ArrowUpRight size={15} aria-hidden="true" />
      <span className="sr-only">（在新标签页打开）</span>
    </a>
    <p><PhoneText text={source.description} /></p>
  </li>;
}

const Checklist = ({ items }: { items: string[] }) => {
  const [checked, setChecked] = useState<number[]>([]);
  return (
    <div className="bl-guide-checklist">
      <div className="bl-guide-checklist-heading">
        <span>行动清单</span>
        <span aria-live="polite">
          {checked.length} / {items.length}
        </span>
      </div>
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <label>
              <input
                type="checkbox"
                checked={checked.includes(index)}
                onChange={(event) =>
                  setChecked((current) =>
                    event.target.checked
                      ? [...current, index]
                      : current.filter((value) => value !== index),
                  )
                }
              />
              <span className="bl-guide-check-box" aria-hidden="true">
                {checked.includes(index) && (
                  <Check size={13} strokeWidth={2.5} />
                )}
              </span>
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <p>可勾选整理思路，离开页面后重置。</p>
    </div>
  );
};

const GuideTemplate = ({ title, text }: { title: string; text: string }) => {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    setStatus('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(translateText(text));
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };
  return (
    <section className="bl-guide-template" aria-label={title}>
      <div className="bl-guide-template-heading">
        <h3>{title}</h3>
        <Button onClick={copy} disabled={status === 'copying'} aria-label={`复制${title}`} icon={status === 'copied' ? <Check aria-hidden="true" strokeWidth={1.75} /> : <Copy aria-hidden="true" strokeWidth={1.75} />}>
          {status === 'copying' ? '正在复制…' : status === 'copied' ? '已复制' : '复制模板'}
        </Button>
      </div>
      <p className="bl-guide-template-note" data-template-note="">示例模板：请替换方括号中的内容，核对后再发送。</p>
      <pre tabIndex={0}>{text}</pre>
      <p className="bl-guide-template-status" role="status">
        {status === 'failed' ? '浏览器未允许复制，请选中上方文字手动复制。' : status === 'copied' ? '模板已复制。请填写你的真实情况。' : ''}
      </p>
    </section>
  );
};

const BlockRenderer = ({
  block,
  id,
  onCta,
}: {
  block: GuideBlock;
  id: string;
  onCta: (b: Extract<GuideBlock, { type: "cta" }>) => void;
}) => {
  switch (block.type) {
    case 'useful-platforms':
      return <UsefulPlatformsDirectory platforms={block.platforms} title={block.title} text={block.text} />;
    case 'city-exploration':
      return <CityExplorationBlock cities={block.cities} title={block.title} text={block.text} />;
    case 'shopping-directory':
      return <ShoppingDirectory places={block.places} title={block.title} text={block.text} />;
    case 'utility-directory':
      return <UtilityDirectory cities={block.cities} title={block.title} text={block.text} />;
    case 'contact-directory':
      return <UtilityContactDirectory contacts={block.contacts} title={block.title} text={block.text} anchor={block.anchor} />;
    case "freebies":
      return null;
    case "heading":
      return <h2 id={id}>{block.text}</h2>;
    case "paragraph":
      return <p><PhoneText text={block.text} /></p>;
    case "list":
      return (
        <GuidePhoneDirectoryOr items={block.items}><ul className="bl-guide-bullet-list">
          {block.items.map((item, i) => (
            <li key={i}><PhoneText text={item} /></li>
          ))}
        </ul></GuidePhoneDirectoryOr>
      );
    case "checklist":
      return <Checklist items={block.items} />;
    case "template":
      return <GuideTemplate title={block.title} text={block.text} />;
    case "route":
      return <GuideRouteRenderer block={block} id={id} />;
    case "link": {
      const internalPath = block.url.startsWith('https://www.baylink.us/') ? block.url.slice('https://www.baylink.us'.length) : block.url;
      const internal = /^\/(?![/\\])/.test(internalPath) && !internalPath.includes('\\') ? internalPath : null;
      return <div className="bl-guide-source-link">{internal ? <Link to={internal}>{block.title}<ArrowRight size={16} aria-hidden="true" /></Link> : /^https?:\/\//i.test(block.url) ? <a href={block.url} target="_blank" rel="noopener noreferrer">{block.title}<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only">（在新标签页打开）</span></a> : <strong>{block.title}</strong>}<p><PhoneText text={block.text} /></p></div>;
    }
    case "tip":
      return (
        <aside className="bl-guide-tip">
          <span>
            <Lightbulb size={17} aria-hidden="true" />
            {block.title || "提示"}
          </span>
          <p><PhoneText text={block.text} /></p>
        </aside>
      );
    case "cta":
      return (
        <section className="bl-guide-cta">
          {/* G6: sentence case, no tracking. */}
          <EnglishOnly><span className="bl-guide-eyebrow">Your next step</span></EnglishOnly>
          <h3>{block.title}</h3>
          <p>{block.text}</p>
          {block.primaryAction === "post" ? (
            block.postChoices?.length ? (
              <div
                className="bl-guide-cta-choices"
                aria-label={block.primaryLabel}
              >
                {block.postChoices.map((choice) => (
                  <Button key={choice.categorySlug} onClick={() => onCta({ ...block, postCategorySlug: choice.categorySlug })}>
                    {choice.label}
                  </Button>
                ))}
              </div>
            ) : (
              <Button variant="primary" onClick={() => onCta(block)}>{block.primaryLabel}</Button>
            )
          ) : (
            <Button variant="primary" to={block.primaryAction === "category" && block.categorySlug ? `/category/${block.categorySlug}` : "/guides"}>
              {block.primaryLabel}
            </Button>
          )}
        </section>
      );
    default:
      return null;
  }
};
