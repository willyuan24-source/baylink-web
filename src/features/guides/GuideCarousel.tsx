import { useId, useState } from 'react';
import { Check, ChevronDown, Gift, HeartHandshake, House, Landmark, ShieldAlert, Stethoscope, TrainFront, Trees, type LucideIcon } from 'lucide-react';
import { Carousel } from '../../components/ui/Carousel';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SegmentedTitle } from '../../components/SegmentedTitle';
import type { Guide } from '../../data/guides';
import type { EditorialPhone, GuideEditorial, GuideSlide } from '../../data/guide-editorial';
import { guideTopicOf, type GuideTopicId } from '../../data/guide-topics';
import { guideEnglishDate, guideSourceCount } from './guide-facts';

/** Phone numbers and other digit runs never break across lines ("800-510-
2020" at 特大). */
const keepNumbers = (text: string) => text.split(/(\d[\d-]{5,}\d)/).map((part, index) => index % 2 ? <span key={index} className="gd-nowrap">{part}</span> : part);

const TOPIC_MARKS: Record<GuideTopicId, LucideIcon> = { elders: HeartHandshake, health: Stethoscope, documents: Landmark, housing: House, transport: TrainFront, savings: Gift, outings: Trees };

/**
 * 看 (1007 §5.5, design.md §4.10): the pilot guide's slides — a white cover with the first answer on a cream band, then one
 * point per slide with its source pinned at the bottom, each led by its green number badge (UI9-R2-GUIDE). Real text, so it translates, reads aloud and grows with Aa; phone numbers
 * are tel: buttons. Facts come only from the article (src/data/guide-editorial).
 */
export function GuideCarousel({ guide, editorial }: { guide: Guide; editorial: GuideEditorial }) {
  const { t, pick, english } = useUiCopy();
  // 特大 (UI9-GUIDES): the cover slide only, then 看全部 N 张卡片 opens the rest as one list (no sideways scroller, N25). The
  // button shows in 特大 only (guide-article.css); 简洁显示 hides the whole carousel, whose facts are in 30 秒看懂.
  const [all, setAll] = useState(false);
  // Each slide is named by its title line (aria-labelledby): the titles are styled lines, not headings (N02).
  const id = useId();
  const total = editorial.slides.length + 1;
  const sourceTitle = (index?: number) => index && guide.sources[index - 1] ? guide.sources[index - 1].title : undefined;
  // H13: the caution 以机构确认为准 is said once, on the cover slide; each point slide names only its source.
  const footer = (index?: number) => {
    const title = sourceTitle(index);
    return <p className="gd-slide__source">{title ? <>{t('来源：', 'Source: ')}<span>{title}</span></> : t('出自本文整理', 'From this guide')}</p>;
  };
  // Each slide opens on its green number badge (UI9-R2-GUIDE); the carousel's own counter says "2/9" (the slide groups are
  // named "2 / 9"), so the badge is decoration for the eye.
  const number = (position: number) => <span className="gd-slide__number" aria-hidden="true">{position}</span>;
  const phone = (entry: EditorialPhone, big = false) => <a className="gd-slide__phone" data-size={big ? 'big' : undefined} href={`tel:${entry.tel}`}
    aria-label={t(`拨打 ${pick(entry.label)} ${entry.number}`, `Call ${pick(entry.label)} ${entry.number}`)}>
    <span className="gd-slide__phone-label">{pick(entry.label)}</span><span className="gd-slide__phone-number">{entry.number}</span>
  </a>;
  const { cover } = editorial;
  // The same count and date as the head meta line: de-duplicated source URLs, an English date, one source in the singular.
  const sources = guideSourceCount(guide), date = guideEnglishDate(guide.updatedAt);
  // The date and 整理 / "updated" stay together on one line, so a wrapped kicker never leaves 理 alone (family link, 特大).
  const dated = <span className="gd-nowrap">{t(`${guide.updatedAt} 整理`, `updated ${date}`)}</span>;
  const kicker = sources
    ? <>{t(`${sources} 个官方来源`, `${sources} official source${sources === 1 ? '' : 's'}`)} · {dated}</>
    : english ? `Updated ${date}` : dated;
  // Headlines wrap between words (SegmentedTitle, src/lib/title-breaks.ts), not inside 长者 or 路径; the text is the
  // source copy, translated once inside SegmentedTitle.
  const headline = (copy: { zh: string; en: string }) => <SegmentedTitle text={english ? copy.en : copy.zh} />;
  const Mark = TOPIC_MARKS[guideTopicOf(guide)];
  return <div className="gd-carousel" data-all={all ? '' : undefined}>
    <Carousel label={t(`${pick(cover.title)}：${total} 张图解`, `${pick(cover.title)}: ${total} cards`)}>
      {/* data-cover="slide": a coded slide, counted as a picture slot and never as photo area (RC-31), like GuideDiagram's
          data-cover="diagram"; not a listing cover, so the render probe of information cards skips it. */}
      <article className="gd-slide gd-slide--cover" data-kind="cover" data-cover="slide" aria-labelledby={`${id}-slide-1`}>
        <Mark className="gd-slide__mark" aria-hidden="true" strokeWidth={1.25} />
        <div className="gd-slide__top">{number(1)}<span className="gd-slide__kicker">{kicker}</span></div>
        <p className="gd-slide__question">{pick(cover.question)}</p>
        {/* A styled line, not a heading: nothing on the page outranks the H1 (P12). */}
        <p className="gd-slide__cover-title" id={`${id}-slide-1`}>{headline(cover.title)}</p>
        <p className="gd-answer">{cover.phone ? <a href={`tel:${cover.phone.tel}`} aria-label={t(`拨打 ${pick(cover.phone.label)} ${cover.phone.number}`, `Call ${pick(cover.phone.label)} ${cover.phone.number}`)}>{keepNumbers(pick(cover.answer))}</a> : keepNumbers(pick(cover.answer))}</p>
        {cover.line && <p className="gd-slide__line">{pick(cover.line)}</p>}
        <p className="gd-slide__source" data-template-note="">{t('BAYLINK 整理 · 以机构确认为准', 'Compiled by BAYLINK · confirm with the agency')}</p>
      </article>
      {editorial.slides.map((slide: GuideSlide, index) => <article key={index} className="gd-slide" data-kind={slide.kind} data-cover="slide" aria-labelledby={`${id}-slide-${index + 2}`}>
        <div className="gd-slide__top">{number(index + 2)}<span className="gd-slide__kicker">{pick(slide.kicker)}</span></div>
        {/* N02: a styled line like the cover's, not an H3: a 24 px slide title outranked the article's 20 px step H2s. */}
        <p className="gd-slide__title" id={`${id}-slide-${index + 2}`}>{slide.kind === 'safety' && <ShieldAlert aria-hidden="true" strokeWidth={1.75} />}<span>{headline(slide.title)}</span></p>
        {slide.body && <p className="gd-slide__body">{pick(slide.body)}</p>}
        {slide.phones && <div className="gd-slide__phones" data-count={slide.phones.length > 2 ? 'many' : undefined}>{slide.phones.map(entry => <div key={entry.tel}>{phone(entry, slide.phones!.length <= 2)}</div>)}</div>}
        {slide.items && <ul className="gd-slide__items">{slide.items.map(item => <li key={item.zh}>{slide.kind === 'checklist' && <Check aria-hidden="true" strokeWidth={2} />}<span>{pick(item)}</span></li>)}</ul>}
        {footer(slide.source)}
      </article>)}
    </Carousel>
    <button type="button" className="gd-carousel__all" aria-expanded={all} onClick={() => setAll(open => !open)}>
      <span>{all ? t('收起卡片', 'Show fewer cards') : t(`看全部 ${total} 张卡片`, `See all ${total} cards`)}</span><ChevronDown aria-hidden="true" strokeWidth={1.75} />
    </button>
  </div>;
}
