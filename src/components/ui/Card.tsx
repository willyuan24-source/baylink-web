import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import './ui.css';
import './covers.css';
import './cards.css';
import { cx } from './ui-copy';
import { SegmentedTitle } from '../SegmentedTitle';

type Heading = 'h2' | 'h3' | 'h4';
type CardLink = {
  title: string;
  /** In-app route (client navigation) or an absolute/external href. One of the two is required. */
  to?: string;
  href?: string;
  /** Called when the card link is activated (analytics). */
  onOpen?: () => void;
  heading?: Heading;
  /** `lang="en"` for an English title inside a zh page. */
  titleLang?: string;
  /** A member's own words (a nickname): shown exactly as written, never converted to 繁體 or looked up in a dictionary. */
  rawTitle?: boolean;
  /**
   * What the caption shows when the cover already prints the rest of the title (a guide's hook, UI9-C G19): the head of the
   * title, or '' to show none. The link's accessible name stays the full `title`.
   */
  titleShown?: string;
};

function CardTitleLink({ title, to, href, onOpen, titleLang, rawTitle, titleShown }: CardLink) {
  const external = href && /^https?:/.test(href);
  const text = rawTitle ? <span translate="no">{title}</span> : titleShown === undefined ? <SegmentedTitle text={title} />
    : <><span className="sr-only"><SegmentedTitle text={title} /></span>{titleShown && <span aria-hidden="true"><SegmentedTitle text={titleShown} /></span>}</>;
  if (to) return <Link className="ui-card-link" to={to} onClick={onOpen} lang={titleLang}>{text}</Link>;
  return <a className="ui-card-link" href={href} onClick={onOpen} lang={titleLang} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{text}</a>;
}

export type FeedCardProps = CardLink & {
  /** `<EventCover>`, `<OfferCover>`, `<Cover>` … The cover sits above the title visually; the title comes first in the DOM. */
  cover: ReactNode;
  /**
   * The 2-line card meta (UI9-C, G18), the one meta API every card uses: `when` is line 1, the date and time in one pattern
   * (eventWhenLine: "周六 10/17 · 11:00–16:00" / "Sat, Oct 17 · 11am–4pm"); `meta` is line 2, the status and the place,
   * which wraps and is never cut ("Berkeley · 免费").
   */
  when?: ReactNode;
  meta?: ReactNode;
  /** "官网核对 10/7" — the check mark is added here. A card with this line credits its source, so inside a list that names the
   *  info card once (FeedGrid) its coded cover drops the BAYLINK 信息卡 badge (H12, ui.css). */
  trust?: ReactNode;
  /** `<SaveButton>`; rendered as a sibling above the stretched link, never inside it. */
  save?: ReactNode;
  className?: string;
};

/**
 * Two-column feed card (173px at 390): 3:4 cover with stickers, 2-line title, one meta line and a trust row.
 * The whole card is one link (a stretched ::after on the title link); ♡ is a separate button stacked above.
 */
export function FeedCard({ cover, when, meta, trust, save, className, heading = 'h3', ...link }: FeedCardProps) {
  const Title = heading;
  return <article className={cx('ui-feed-card', className)} data-credited={trust ? '' : undefined}>
    <Title className="ui-feed-card__title"><CardTitleLink {...link} /></Title>
    <div className="ui-feed-card__media">{cover}</div>
    {when && <p className="ui-card-when ui-feed-card__when">{when}</p>}
    {meta && <p className="ui-feed-card__meta">{meta}</p>}
    {trust && <p className="ui-feed-card__trust"><Check aria-hidden="true" strokeWidth={1.75} />{trust}</p>}
    {save && <div className="ui-feed-card__save">{save}</div>}
  </article>;
}

export type RowCardProps = CardLink & {
  /** 88×88: a photo `<Cover>` or `<TypeCover size="mini">`. */
  thumb: ReactNode;
  /** Line 1 (G18): "周六 10/17 · 11:00–16:00" (eventWhenLine). `date` is its older name. */
  when?: ReactNode;
  date?: ReactNode;
  /** Line 2: the status and the place; wraps, never cut. */
  meta?: ReactNode;
  /** The thumbnail's provenance words (getImageProvenance) as a 13 px line: a thumbnail (≤ 140 px) carries no chip. */
  credit?: ReactNode;
  /** "官网核对 10/7" under line 2, as on FeedCard (the check mark is added here; UI9-EVENTS: the calendar rows). Optional. */
  trust?: ReactNode;
  /** One trailing action only (♡). Everything else belongs on the detail page or in a "⋯" sheet. */
  trailing?: ReactNode;
  className?: string;
};

/** List row for calendars, search results and saved items: thumbnail, date, 2-line title, meta, one action. */
export function RowCard({ thumb, when, date, meta, credit, trust, trailing, className, heading = 'h3', ...link }: RowCardProps) {
  const line1 = when ?? date;
  const Title = heading;
  return <article className={cx('ui-row-card', className)}>
    <div className="ui-row-card__body">
      <Title className="ui-row-card__title"><CardTitleLink {...link} /></Title>
      {line1 && <p className="ui-row-card__date">{line1}</p>}
      {meta && <p className="ui-row-card__meta">{meta}</p>}
      {trust && <p className="ui-feed-card__trust ui-row-card__trust"><Check aria-hidden="true" strokeWidth={1.75} />{trust}</p>}
      {credit && <p className="ui-row-card__credit">{credit}</p>}
    </div>
    <div className="ui-row-card__thumb">{thumb}</div>
    {trailing && <div className="ui-row-card__trailing">{trailing}</div>}
  </article>;
}
