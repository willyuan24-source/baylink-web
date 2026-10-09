import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import './ui.css';
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
};

function CardTitleLink({ title, to, href, onOpen, titleLang, rawTitle }: CardLink) {
  const external = href && /^https?:/.test(href);
  const text = rawTitle ? <span translate="no">{title}</span> : <SegmentedTitle text={title} />;
  if (to) return <Link className="ui-card-link" to={to} onClick={onOpen} lang={titleLang}>{text}</Link>;
  return <a className="ui-card-link" href={href} onClick={onOpen} lang={titleLang} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{text}</a>;
}

export type FeedCardProps = CardLink & {
  /** `<EventCover>`, `<OfferCover>`, `<Cover>` … The cover sits above the title visually; the title comes first in the DOM. */
  cover: ReactNode;
  /** One line, ellipsis: "Berkeley · 免费". Wrap the free price in <strong>. */
  meta?: ReactNode;
  /** "官网核对 10/7" — the check mark is added here. */
  trust?: ReactNode;
  /** `<SaveButton>`; rendered as a sibling above the stretched link, never inside it. */
  save?: ReactNode;
  className?: string;
};

/**
 * Two-column feed card (173px at 390): 3:4 cover with stickers, 2-line title, one meta line and a trust row.
 * The whole card is one link (a stretched ::after on the title link); ♡ is a separate button stacked above.
 */
export function FeedCard({ cover, meta, trust, save, className, heading = 'h3', ...link }: FeedCardProps) {
  const Title = heading;
  return <article className={cx('ui-feed-card', className)}>
    <Title className="ui-feed-card__title"><CardTitleLink {...link} /></Title>
    <div className="ui-feed-card__media">{cover}</div>
    {meta && <p className="ui-feed-card__meta">{meta}</p>}
    {trust && <p className="ui-feed-card__trust"><Check aria-hidden="true" strokeWidth={1.75} />{trust}</p>}
    {save && <div className="ui-feed-card__save">{save}</div>}
  </article>;
}

export type RowCardProps = CardLink & {
  /** 88×88: a photo `<Cover>` or `<TypeCover size="mini">`. */
  thumb: ReactNode;
  /** "周六 10/10 · 10:00–18:00" in brand 600. */
  date?: ReactNode;
  meta?: ReactNode;
  /** One trailing action only (♡). Everything else belongs on the detail page or in a "⋯" sheet. */
  trailing?: ReactNode;
  className?: string;
};

/** List row for calendars, search results and saved items: thumbnail, date, 2-line title, meta, one action. */
export function RowCard({ thumb, date, meta, trailing, className, heading = 'h3', ...link }: RowCardProps) {
  const Title = heading;
  return <article className={cx('ui-row-card', className)}>
    <div className="ui-row-card__body">
      <Title className="ui-row-card__title"><CardTitleLink {...link} /></Title>
      {date && <p className="ui-row-card__date">{date}</p>}
      {meta && <p className="ui-row-card__meta">{meta}</p>}
    </div>
    <div className="ui-row-card__thumb">{thumb}</div>
    {trailing && <div className="ui-row-card__trailing">{trailing}</div>}
  </article>;
}
