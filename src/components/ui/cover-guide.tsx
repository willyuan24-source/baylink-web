import { Compass, Earth, Gift, House, ShieldCheck, TramFront, Users, type LucideIcon } from 'lucide-react';
import type { CoverLayout } from './CoverImage';
import { TypeFrame, latinLang } from './cover-frame';
import { chooseCover, type CoverListingKind } from '../../lib/cover-family';
import { hookHighlight, splitHook } from '../../lib/guide-hook-phrase';
import { displayUnits } from '../../lib/event-facts';

/** Each guide topic's mark (data-mark), one per topic (G3). */
export const TOPIC_MARKS: Readonly<Record<string, string>> = {
  elders: 'users', health: 'shield-check', documents: 'earth', housing: 'house', transport: 'tram-front', savings: 'gift', outings: 'compass',
};
/** A guide topic's mark; a headline without a topic (a place, a BayBay guide card) draws the slide alone. */
export const topicMark = (topic: string | undefined) => (topic && Object.hasOwn(TOPIC_MARKS, topic) && TOPIC_MARKS[topic]) || 'slide';

/**
 * The marks as drawn, cropped on the headline slide at stroke 1.25. Each is a Lucide icon the home page already ships (its
 * header, tab bar and mood circles), so the marks add no icon bytes to the page.
 */
const TOPIC_ICONS: Readonly<Record<string, LucideIcon>> = {
  users: Users, 'shield-check': ShieldCheck, earth: Earth, house: House, 'tram-front': TramFront, gift: Gift, compass: Compass,
};
export const TopicMark = ({ mark }: { mark: string }) => {
  const Icon = Object.hasOwn(TOPIC_ICONS, mark) ? TOPIC_ICONS[mark] : undefined;
  return Icon ? <span className="tc-mark" aria-hidden="true"><Icon strokeWidth={1.25} /></span> : null;
};

// A US number as covers print it (phone-numbers.ts coverPhoneKeep's pattern): kept whole with non-breaking hyphens.
const PHONE = /(^|[^\d-])((?:1-)?\d{3}-\d{3}-\d{4})(?![\d-])/;
/** The phone number in a hook, with non-breaking hyphens (U+2011), and the words around it. */
export const hookPhone = (hook: string) => {
  const match = PHONE.exec(hook);
  if (!match) return undefined;
  const at = match.index + match[1].length;
  const words = `${hook.slice(0, at)} ${hook.slice(at + match[2].length)}`.replace(/[：:]\s*$/, '').replace(/[：:]\s+/, ' ').trim();
  return { number: match[2].replace(/-/g, '‑'), words };
};

/** Family number (G5): the words, then the number on one line on the brand-green plate; a thumbnail shows the topic mark only. */
export function NumberFace({ hook, eyebrow, mark, mini }: { hook: string; eyebrow?: string; mark: string; mini: boolean }) {
  if (mini) return <TopicMark mark={mark} />;
  const phone = hookPhone(hook);
  return <>
    {eyebrow && <p className="tc-eyebrow">{eyebrow}</p>}
    <p className="tc-plate ui-plate">{phone?.words && <span>{phone.words}</span>}<span className="tc-num" data-phone>{phone?.number ?? hook}</span></p>
    <TopicMark mark={mark} />
  </>;
}

/**
 * Family headline (G19): the hook with exactly one lime phrase on the deep-green slide, and the cropped topic mark. A
 * thumbnail shows the topic mark, or, with no topic (a place or a saved item from an older caller), its words.
 */
export function HeadlineFace({ hook, hi, eyebrow, mark, mini }: { hook: string; hi?: string; eyebrow?: string; mark: string; mini: boolean }) {
  if (mini) return mark === 'slide' ? <p className="tc-thumb">{eyebrow || hook}</p> : <TopicMark mark={mark} />;
  const parts = splitHook(hook, hi ?? hookHighlight(hook));
  return <>
    {eyebrow && <p className="tc-eyebrow">{eyebrow}</p>}
    {/* A long hook (over 16 CJK units, "看房、转账、签合同前先检查什么") is set a step smaller, so a card keeps its frame. */}
    <p className="tc-hook" lang={latinLang(hook)} data-long={displayUnits(hook) > 16 ? '' : undefined}>{parts ? <>{parts[0]}<em>{parts[1]}</em>{parts[2]}</> : hook}</p>
    <TopicMark mark={mark} />
  </>;
}

/**
 * A guide's coded cover (G19): the hook (its one-line answer, else the title after the colon) with one lime phrase on the
 * deep-green slide, or the number plate when the hook is a phone number. Thumbnails show the topic mark and never a number.
 */
export type GuideTypeCoverProps = CoverLayout & { slug: string; topic: string; topicLabel: string; hook: string; hi?: string; kind?: CoverListingKind };
export function GuideTypeCover({ slug, topic, topicLabel, hook, hi, kind = 'guide', ...layout }: GuideTypeCoverProps) {
  const choice = chooseCover(kind, { tier: 'type' }, { id: slug, hook, phone: !!hookPhone(hook), mark: topicMark(topic) });
  const mini = layout.size === 'mini';
  return <TypeFrame {...layout} {...choice} kind={kind}>
    {choice.family === 'number' ? <NumberFace hook={hook} eyebrow={topicLabel} mark={topicMark(topic)} mini={mini} />
      : <HeadlineFace hook={hook} hi={hi} eyebrow={topicLabel} mark={choice.mark} mini={mini} />}
  </TypeFrame>;
}
