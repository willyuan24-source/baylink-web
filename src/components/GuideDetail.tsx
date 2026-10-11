import { PerksGallery } from './PerksGallery';
import { EnglishOnly } from './EnglishOnly';
import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Lightbulb,
  List,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getGuideBySlug,
  guides,
  type Guide,
  type GuideBlock,
} from "../data/guides";
import { getGuideMedia, type GuideImage } from '../data/guide-media';
import { OutingInspirationLink } from './OutingInspirationLink';
import { GuideFigure, GuideRouteRenderer } from './GuideVisuals';
import { GuideEditionNotice } from './GuideEditionNotice';
import { FreebieBoard } from './FreebieBoard';
import { discoverRelatedGuides } from '../lib/guide-discovery';
import { translateText } from '../i18n/locale';
import { UtilityDirectory, UtilityContactDirectory } from './UtilityDirectory';
import { ShoppingDirectory } from './ShoppingDirectory';
import { CityExplorationDirectory } from './CityExplorationDirectory';
import { UsefulPlatformsDirectory } from './UsefulPlatformsDirectory';
import { PhoneDirectoryOr, PhoneText } from '../lib/phone-links';
import { createCoverPage, distinctNeighbourTones, type CoverPage } from '../lib/cover';
import { useBayAreaToday } from '../lib/useBayAreaToday';
import { useUiCopy } from './ui/ui-copy';
import { CoverImage } from './ui/CoverImage';
import { COVER_SIZES } from './ui/cover-sizes';
import { FeedGrid, FeedItem } from './ui/FeedGrid';
import { FeedCard } from './ui/Card';
import { getGuideEditorial, type EditorialCopy, type GuideEditorial } from '../data/guide-editorial';
import { guideTopicOf } from '../data/guide-topics';
import { GuideHeader } from '../features/guides/GuideHeader';
import { GuideActions } from '../features/guides/GuideActions';
import { GuideCarousel } from '../features/guides/GuideCarousel';
import { ContactCards, KeyFactsCard } from '../features/guides/GuideFactCards';
import { GuideCover } from '../features/guides/GuideCover';
import { GuidePageImageCredits } from '../features/guides/GuidePageParts';
import { guideCover, guideReadMinutes, guideSourceCount, keepInlineImage, TOPIC_COVER } from '../features/guides/guide-facts';
import { LazyReportErrorLink } from '../features/feedback/LazyEntryLinks';
import '../features/guides/guide-article.css';

type GuideDetailProps = {
  slug: string;
  returnTo?: string;
  today?: string;
  /** Kept for callers; the breadcrumb's "‹ 指南" link returns to `returnTo`. */
  onBack?: () => void;
  onOpenGuide: (slug: string) => void;
  onNavigate: (path: string) => void;
  onAsk?: (question: string) => void;
  onOpenPost: (options: {
    type: "client" | "provider";
    categorySlug: string;
  }) => void;
};

export const GuideDetail = (props: GuideDetailProps) => <GuideDetailSession key={props.slug} {...props} />;

const FREEBIE_GALLERIES: Record<string, 'birthday' | 'everyday' | 'retail' | undefined> = {
  'bay-area-birthday-perks': 'birthday', 'bay-area-everyday-free-perks': 'everyday', 'bay-area-retail-freebies-family-deals': 'retail', 'bay-area-freebies-deals-2026-10': undefined,
};

/** Related guides as covers (two columns on a phone), resolved on the article's cover page so no image repeats. */
function RelatedGuides({ related, coverPage, today, onOpenGuide }: { related: Guide[]; coverPage: CoverPage; today: string; onOpenGuide: (slug: string) => void }) {
  const { t, english, locale } = useUiCopy();
  const covers = related.map(guide => guideCover(guide, today, coverPage));
  const tones = distinctNeighbourTones(covers.map((cover, index) => cover.tier === 'type' ? TOPIC_COVER[guideTopicOf(related[index])].tone : null));
  return <section className="bl-guide-related gd-related" aria-labelledby="gd-related-title">
    <div className="gd-related__head">
      <h2 id="gd-related-title">{t('接下来，你可能想看', 'Read next')}</h2>
      <Link to="/guides">{t('全部指南', 'All guides')}</Link>
    </div>
    <FeedGrid label={t('相关指南', 'Related guides')}>{related.map((guide, index) => <FeedItem key={guide.slug}>
      <FeedCard title={translateText(guide.title, locale)} titleLang={english ? 'en' : undefined} heading="h3" to={`/guides/${guide.slug}`} onOpen={() => onOpenGuide(guide.slug)}
        cover={<GuideCover guide={guide} cover={covers[index]} tone={tones[index] ?? undefined} sizes={COVER_SIZES.feed} />}
        meta={t(`${guideSourceCount(guide)} 个官方来源 · 约 ${guideReadMinutes(guide)} 分钟`, `${guideSourceCount(guide)} official sources · ${guideReadMinutes(guide)} min read`)} />
    </FeedItem>)}</FeedGrid>
  </section>;
}

/** A pilot guide's H2 as a step card: a numeral, the original heading (anchor kept) and a one-line conclusion; the original
 * prose and its links fold under "展开原文与来源" (design.md §4.10). Without a conclusion the prose stays open. */
function StepSection({ number, heading, id, conclusion, children }: { number: number; heading: string; id: string; conclusion?: EditorialCopy; children: ReactNode }) {
  const { t, pick } = useUiCopy();
  return <section className="gd-step" aria-labelledby={id}>
    <div className="gd-step__head">
      <span className="gd-step__number" aria-hidden="true">{number}</span>
      <div><h2 id={id}>{heading}</h2>{conclusion && <p className="gd-step__conclusion">{pick(conclusion)}</p>}</div>
    </div>
    {conclusion ? <details className="gd-step__more"><summary>{t('展开原文与来源', 'Full text and sources')}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary><div className="bl-guide-prose">{children}</div></details>
      : <div className="bl-guide-prose">{children}</div>}
  </section>;
}

const GuideDetailSession = ({
  slug,
  returnTo = '/guides',
  today: suppliedToday,
  onOpenGuide,
  onNavigate,
  onAsk,
  onOpenPost,
}: GuideDetailProps) => {
  const guide = getGuideBySlug(slug);
  const { t, english } = useUiCopy();
  const today = useBayAreaToday(suppliedToday);
  const editorial: GuideEditorial | undefined = guide ? getGuideEditorial(guide.slug) : undefined;
  const page = useMemo(() => {
    if (!guide) return null;
    const coverPage = createCoverPage();
    const media = getGuideMedia(guide);
    const cover = guideCover(guide, today, coverPage);
    const inline = media.inline.filter(item => keepInlineImage(item.image, guide, guides));
    return { coverPage, cover, inline, related: discoverRelatedGuides(guide, 4, today) };
  }, [guide, today]);

  if (!guide || !page)
    return (
      <div className="bl-guide-empty">
        <BookOpen size={30} aria-hidden="true" />
        <h1>未找到该指南</h1>
        <p>链接可能已失效或文章已移除</p>
        <button type="button" onClick={() => onNavigate("/guides")}>
          返回湾区指南 <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    );
  const { cover, related, coverPage } = page;
  const prefaceLength = Math.max(0, guide.blocks.findIndex(block => block.type === 'freebies'));
  const headingIndexes = guide.blocks.flatMap((block, index) => block.type === 'heading' ? [index] : []);
  const inlineAfter = new Map<number, GuideImage[]>();
  for (const item of page.inline) {
    if (!Number.isInteger(item.afterHeading) || item.afterHeading < 1 || item.afterHeading > headingIndexes.length) continue;
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
  const renderBlock = (block: GuideBlock, index: number) => (
    <Fragment key={`${slug}-${index}`}>
      <BlockRenderer block={block} id={`guide-section-${index}`} onCta={handleCta} />
      {inlineAfter.get(index)?.map(image => <GuideFigure key={image.src} image={image} />)}
    </Fragment>
  );
  // Pilot guides: each H2 and the blocks under it become one step card.
  const bodyBlocks = guide.blocks.map((block, index) => ({ block, index })).filter(({ index }) => index >= prefaceLength);
  const stepHeadings = headingIndexes.filter(index => index >= prefaceLength);
  const body = !editorial?.steps ? <div className="bl-guide-prose">{bodyBlocks.map(({ block, index }) => renderBlock(block, index))}</div> : <>
    {bodyBlocks.some(({ index }) => !stepHeadings.length || index < stepHeadings[0]) && <div className="bl-guide-prose">{bodyBlocks.filter(({ index }) => !stepHeadings.length || index < stepHeadings[0]).map(({ block, index }) => renderBlock(block, index))}</div>}
    {stepHeadings.map((headingIndex, order) => {
      const next = stepHeadings[order + 1] ?? guide.blocks.length;
      const heading = guide.blocks[headingIndex] as Extract<GuideBlock, { type: 'heading' }>;
      return <StepSection key={headingIndex} number={order + 1} heading={heading.text} id={`guide-section-${headingIndex}`} conclusion={editorial.steps?.[headingIndexes.indexOf(headingIndex)]}>
        {bodyBlocks.filter(({ index }) => index > headingIndex && index < next).map(({ block, index }) => renderBlock(block, index))}
      </StepSection>;
    })}
  </>;
  const contents = (
    <ol>
      {guide.blocks.filter(block => block.type === 'freebies').map((block, index) => <li key={`freebies-${index}`}><a href={`#freebie-board-${index}`}><span>🎁</span>{block.title}</a></li>)}
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
          <span>
            <ChevronRight size={13} aria-hidden="true" />
          </span>
          官方参考资料
        </a>
      </li>
    </ol>
  );
  const visual = editorial ? <GuideCarousel guide={guide} editorial={editorial} />
    : cover.tier !== 'type' ? <CoverImage className="gd-cover" image={cover.image} label={english ? cover.label.en : translateText(cover.label.zh)} fit={cover.fit} focal={cover.focal} ratio="3:2" sizes={COVER_SIZES.detail} priority /> : null;

  return (
    <div className="bl-guide-detail gd-page" data-pilot={editorial ? '' : undefined}>
      <article className="bl-guide-article gd-article">
        <GuideHeader guide={guide} returnTo={returnTo} />
        <div className="gd-lead" data-visual={visual ? '' : undefined}>
          {visual && <div className="gd-lead__visual">{visual}</div>}
          <div className="gd-lead__side">
            <GuideActions guide={guide} onAsk={onAsk} />
            {guide.blocks.some(block => block.type === 'freebies') && <a className="bl-freebie-jump" href="#freebie-board-0">看免费领取图鉴<ArrowDownRight size={17} aria-hidden="true" /></a>}
            {guide.editionMonth && <GuideEditionNotice offers={guide.slug.startsWith('bay-area-freebies-deals-') || guide.blocks.some(block => block.type === 'freebies')} editionMonth={guide.editionMonth} startDate={guide.editionStartDate} throughDate={guide.editionThroughDate} checkedAt={guide.updatedAt} today={today} />}
            {editorial ? <KeyFactsCard guide={guide} facts={editorial.keyFacts} />
              : <div className="gd-summary"><p>{guide.summary}</p>{guide.audience.length > 0 && <p className="gd-summary__audience"><span>{t('适合：', 'For: ')}</span>{guide.audience.map((audience, index) => <Fragment key={audience}>{index > 0 && '、'}<span>{audience}</span></Fragment>)}</p>}</div>}
          </div>
        </div>
        {editorial?.contacts && <ContactCards guide={guide} contacts={editorial.contacts} />}
        {prefaceLength > 0 && <div className="bl-guide-prose">{guide.blocks.slice(0, prefaceLength).map(renderBlock)}</div>}
        {guide.slug in FREEBIE_GALLERIES && <PerksGallery topic={FREEBIE_GALLERIES[guide.slug]} />}
        {guide.blocks.filter(block => block.type === 'freebies').map((block, index) => <div id={`freebie-board-${index}`} key={index}><FreebieBoard offers={block.offers} title={block.title} description={block.text} today={today} /></div>)}
        <div className="bl-guide-reading-layout">
          <aside className="bl-guide-toc" aria-label="文章目录">
            <div className="bl-guide-toc-desktop">
              <h2>
                <List size={16} aria-hidden="true" /> 这篇会读到
              </h2>
              {contents}
            </div>
            <details className="bl-guide-toc-mobile">
              <summary>
                <List size={16} aria-hidden="true" /> 文章目录{" "}
                <span>{headings.length} 个章节</span>
              </summary>
              {contents}
            </details>
          </aside>
          <div className="bl-guide-reading-main">
            {guide.cover && (
              <details className="guide-poster-disclosure">
                <summary>查看原版图文海报<ChevronDown size={17} aria-hidden="true" /></summary>
                <GuideFigure variant="poster" image={{ src: guide.cover, alt: `${guide.title} 原版图文海报`, caption: '原版图文海报作为补充阅读，最新整理请以本文正文及官方资料为准。', credit: 'BAYLINK 原有指南附图', kind: 'illustration', width: 1055, height: 1491 }} />
              </details>
            )}
            {body}
            {(guide.category === 'city' || guide.category === 'events') && <OutingInspirationLink kind="guide" id={guide.slug} />}
            <section
              className="bl-guide-sources"
              aria-labelledby="guide-sources"
            >
              <span className="bl-guide-source-icon">
                <ShieldCheck size={22} strokeWidth={1.4} aria-hidden="true" />
              </span>
              <h2 id="guide-sources">官方参考资料与办事入口</h2>
              <p>
                按你的具体情况核对原始资料。票价、开放时间、法规和服务安排可能变化。
              </p>
              <ul>
                {guide.sources.map((source, index) => (
                  <li key={source.url} id={`guide-source-${index + 1}`}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.title}
                      <ArrowUpRight size={15} aria-hidden="true" />
                      <span className="sr-only">（在新标签页打开）</span>
                    </a>
                    <p>{source.description}</p>
                  </li>
                ))}
              </ul>
              <LazyReportErrorLink key={`report-guide-${slug}`} className="feedback-report-row--guide" entity={{ kind: 'guide', id: slug }} title={guide.title} />
            </section>
            {guide.sourceNote && (
              <p className="bl-guide-source-note">{guide.sourceNote}</p>
            )}
            <GuidePageImageCredits images={shownImages} />
          </div>
        </div>
        {related.length > 0 && <RelatedGuides related={related} coverPage={coverPage} today={today} onOpenGuide={onOpenGuide} />}
        <Link to={returnTo} className="bl-guide-return">
          <ArrowLeft size={16} aria-hidden="true" />
          返回湾区指南
        </Link>
      </article>
    </div>
  );
};

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
        <button type="button" onClick={copy} disabled={status === 'copying'} aria-label={`复制${title}`}>
          {status === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {status === 'copying' ? '正在复制…' : status === 'copied' ? '已复制' : '复制模板'}
        </button>
      </div>
      <p className="bl-guide-template-note">示例模板：请替换方括号中的内容，核对后再发送。</p>
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
      return <CityExplorationDirectory cities={block.cities} title={block.title} text={block.text} />;
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
        <PhoneDirectoryOr items={block.items}><ul className="bl-guide-bullet-list">
          {block.items.map((item, i) => (
            <li key={i}><PhoneText text={item} /></li>
          ))}
        </ul></PhoneDirectoryOr>
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
          <EnglishOnly><span className="bl-guide-eyebrow">YOUR NEXT STEP</span></EnglishOnly>
          <h3>{block.title}</h3>
          <p>{block.text}</p>
          {block.primaryAction === "post" ? (
            block.postChoices?.length ? (
              <div
                className="bl-guide-cta-choices"
                aria-label={block.primaryLabel}
              >
                {block.postChoices.map((choice) => (
                  <button
                    key={choice.categorySlug}
                    type="button"
                    onClick={() =>
                      onCta({ ...block, postCategorySlug: choice.categorySlug })
                    }
                  >
                    {choice.label}
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => onCta(block)}>
                {block.primaryLabel}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )
          ) : (
            <Link
              to={
                block.primaryAction === "category" && block.categorySlug
                  ? `/category/${block.categorySlug}`
                  : "/guides"
              }
            >
              {block.primaryLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </section>
      );
    default:
      return null;
  }
};
