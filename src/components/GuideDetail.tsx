import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Lightbulb,
  List,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getGuideBySlug,
  type GuideBlock,
} from "../data/guides";
import { GuideCardMini } from "./GuideCard";
import { getGuideMedia, type GuideImage } from '../data/guide-media';
import { GuideFigure, GuideRouteRenderer } from './GuideVisuals';
import { GuideEditionNotice } from './MonthlyDealsSpotlight';
import { FreebieBoard } from './FreebieBoard';
import { GuideReaderActions } from './ReaderLibrary';
import { discoverRelatedGuides } from '../lib/guide-discovery';
import { translateText } from '../i18n/locale';

type GuideDetailProps = {
  slug: string;
  returnTo?: string;
  today?: string;
  onBack: () => void;
  onOpenGuide: (slug: string) => void;
  onNavigate: (path: string) => void;
  onAsk?: (question: string) => void;
  onOpenPost: (options: {
    type: "client" | "provider";
    categorySlug: string;
  }) => void;
};

export const GuideDetail = (props: GuideDetailProps) => <GuideDetailSession key={props.slug} {...props} />;

const GuideDetailSession = ({
  slug,
  returnTo = '/guides',
  today,
  onBack,
  onOpenGuide,
  onNavigate,
  onAsk,
  onOpenPost,
}: GuideDetailProps) => {
  const guide = getGuideBySlug(slug);
  const articleRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    // The shared layout may scroll the app root, the page, or a bounded pane.
    // Measure the actual scrolling ancestor instead of assuming main owns it.
    let ancestor = article.parentElement;
    let container: HTMLElement | null = null;
    while (ancestor) {
      if (
        /auto|scroll|overlay/.test(getComputedStyle(ancestor).overflowY) &&
        ancestor.scrollHeight > ancestor.clientHeight
      ) {
        container = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    const target = container || window;
    let frame = 0;
    const measure = () => {
      const rect = article.getBoundingClientRect();
      const top = container ? container.getBoundingClientRect().top : 0;
      const visibleHeight = container?.clientHeight || window.innerHeight;
      const distance = rect.height - visibleHeight;
      setProgress(
        distance > 0
          ? Math.round(
              Math.min(100, Math.max(0, ((top - rect.top) / distance) * 100)),
            )
          : 100,
      );
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [slug]);

  if (!guide)
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
  const related = discoverRelatedGuides(guide, 3, today);
  const media = getGuideMedia(guide);
  const headingIndexes = guide.blocks.flatMap((block, index) => block.type === 'heading' ? [index] : []);
  const inlineAfter = new Map<number, GuideImage[]>();
  for (const item of media.inline) {
    if (!Number.isInteger(item.afterHeading) || item.afterHeading < 1 || item.afterHeading > headingIndexes.length) continue;
    const lastBlock = (headingIndexes[item.afterHeading] ?? guide.blocks.length) - 1;
    inlineAfter.set(lastBlock, [...(inlineAfter.get(lastBlock) || []), item.image]);
  }
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
            <ArrowUpRight size={13} aria-hidden="true" />
          </span>
          官方参考资料
        </a>
      </li>
    </ol>
  );

  return (
    <div className="bl-guide-detail bl-guide-detail--visual">
      <div className="bl-guide-reader-bar">
        <button type="button" onClick={onBack} aria-label="返回湾区指南">
          <ArrowLeft size={17} aria-hidden="true" />
          <span>湾区指南</span>
        </button>
        <span className="bl-guide-reader-label">THE BAYLINK JOURNAL</span>
        <span
          className="bl-guide-reader-progress"
          aria-label={`阅读进度 ${progress}%`}
        >
          {progress}%
        </span>
        <div className="bl-guide-progress-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
      </div>
      <article ref={articleRef} className="bl-guide-article">
        <header className="bl-guide-article-header">
          <div className="bl-guide-article-kicker">
            <Link to={returnTo}>湾区生活指南</Link>
            <span>/</span>
            <span>{guide.categoryLabel}</span>
            {guide.priority === "P0" && (
              <span className="bl-guide-essential">新手必看</span>
            )}
          </div>
          <h1>{guide.title}</h1>
          <p className="bl-guide-subtitle">{guide.subtitle}</p>
          {guide.blocks.some(block => block.type === 'freebies') && <a className="bl-freebie-jump" href="#freebie-board-0">看免费领取图鉴<ArrowDownRight size={17} aria-hidden="true" /></a>}
          <div className="bl-guide-byline">
            <span className="bl-guide-editor-mark">B.</span>
            <span>
              <strong>BAYLINK 生活整理</strong>
              <small>更新 {guide.updatedAt}</small>
            </span>
            <span className="bl-guide-reading-time">
              <Clock3 size={15} aria-hidden="true" />
              {guide.readMinutes} 分钟阅读
            </span>
          </div>
          {guide.editionMonth && <GuideEditionNotice editionMonth={guide.editionMonth} checkedAt={guide.updatedAt} today={today} />}
          <GuideReaderActions guide={guide} onAsk={onAsk} />
          <GuideFigure image={media.cover} variant="cover" />
          <div className="bl-guide-abstract">
            <span>这篇指南，帮你理清</span>
            <p>{guide.summary}</p>
            {guide.audience.length > 0 && (
              <div className="bl-guide-audience">
                {guide.audience.map((a) => (
                  <span key={a}>{a}</span>
                ))}
              </div>
            )}
          </div>
        </header>
        {guide.blocks.filter(block => block.type === 'freebies').map((block, index) => <div id={`freebie-board-${index}`} key={index}><FreebieBoard offers={block.offers} title={block.title} description={block.text} today={today} /></div>)}
        <div className="bl-guide-reading-layout">
          <aside className="bl-guide-toc" aria-label="文章目录">
            <div className="bl-guide-toc-desktop">
              <h2>
                <List size={16} aria-hidden="true" /> 这篇会读到
              </h2>
              {contents}
              <p>先了解，再行动。</p>
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
            <div className="bl-guide-prose">
              {guide.blocks.map((block, index) => (
                <Fragment key={`${slug}-${index}`}>
                  <BlockRenderer block={block} id={`guide-section-${index}`} onCta={handleCta} />
                  {inlineAfter.get(index)?.map(image => <GuideFigure key={image.src} image={image} />)}
                </Fragment>
              ))}
            </div>
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
                {guide.sources.map((source) => (
                  <li key={source.url}>
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
            </section>
            {guide.sourceNote && (
              <p className="bl-guide-source-note">{guide.sourceNote}</p>
            )}
          </div>
        </div>
        {related.length > 0 && (
          <section className="bl-guide-related">
            <div className="bl-guide-related-heading">
              <div>
                <span className="bl-guide-eyebrow">KEEP EXPLORING</span>
                <h2>接下来，你可能想看</h2>
              </div>
              <Link to="/guides">
                全部指南 <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="bl-guide-related-grid">
              {related.map((g) => (
                <GuideCardMini
                  key={g.slug}
                  guide={g}
                  onClick={() => onOpenGuide(g.slug)}
                />
              ))}
            </div>
          </section>
        )}
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
    case "freebies":
      return null;
    case "heading":
      return <h2 id={id}>{block.text}</h2>;
    case "paragraph":
      return <p>{block.text}</p>;
    case "list":
      return (
        <ul className="bl-guide-bullet-list">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "checklist":
      return <Checklist items={block.items} />;
    case "template":
      return <GuideTemplate title={block.title} text={block.text} />;
    case "route":
      return <GuideRouteRenderer block={block} id={id} />;
    case "link":
      return <div className="bl-guide-source-link">{/^https?:\/\//i.test(block.url) ? <a href={block.url} target="_blank" rel="noopener noreferrer">{block.title}<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only">（在新标签页打开）</span></a> : <strong>{block.title}</strong>}<p>{block.text}</p></div>;
    case "tip":
      return (
        <aside className="bl-guide-tip">
          <span>
            <Lightbulb size={17} aria-hidden="true" />
            {block.title || "提示"}
          </span>
          <p>{block.text}</p>
        </aside>
      );
    case "cta":
      return (
        <section className="bl-guide-cta">
          <span className="bl-guide-eyebrow">YOUR NEXT STEP</span>
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
                    <ArrowUpRight size={15} aria-hidden="true" />
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
