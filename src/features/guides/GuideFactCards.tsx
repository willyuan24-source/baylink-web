import { useState, type ReactNode } from 'react';
import { Check, Copy, MapPin, Phone } from 'lucide-react';
import { StatusChip } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { Guide } from '../../data/guides';
import type { GuideContact, GuideKeyFact } from '../../data/guide-editorial';
import { linkifyPhones } from '../../lib/phone-links';
import { copyText } from '../../utils/postShare';
import { quickFactIn, type QuickFact } from './guide-quick-facts';

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬'];

/** A superscript ① that jumps to the article's source list (its anchor `guide-source-n`). */
export function SourceMark({ guide, index }: { guide: Guide; index?: number }) {
  const { t } = useUiCopy();
  if (!index || !guide.sources[index - 1]) return null;
  return <a className="gd-source-mark" href={`#guide-source-${index}`} aria-label={t(`来源 ${index}`, `Source ${index}`)}>{CIRCLED[index - 1] ?? `[${index}]`}</a>;
}

/** The ① mark holds on to the last two characters (or the phone chip) before it, so it never wraps onto a line alone. */
function withMark(parts: ReactNode[], mark: ReactNode): ReactNode {
  if (!mark) return parts;
  const head = parts.slice(0, -1), last = parts.at(-1);
  if (typeof last !== 'string') return <>{head}<span className="gd-nowrap">{last}{mark}</span></>;
  const chars = Array.from(last), tail = chars.slice(-2).join('');
  return <>{head}{chars.slice(0, -2).join('')}<span className="gd-nowrap">{tail}{mark}</span></>;
}

/**
 * 查 · "30 秒看懂" (design.md §4.10, GUIDE-04): three to five rows, each a short label over the decisive value; phone numbers
 * are tap-to-call buttons and ① marks link to the sources.
 */
export function KeyFactsCard({ guide, facts }: { guide: Guide; facts: readonly GuideKeyFact[] }) {
  const { t, pick } = useUiCopy();
  return <section className="gd-keyfacts" aria-labelledby="gd-keyfacts-title">
    <h2 id="gd-keyfacts-title">{t('30 秒看懂', 'In 30 seconds')}</h2>
    <ol>{facts.map(fact => <li key={fact.label.zh}>
      <span className="gd-keyfacts__label">{pick(fact.label)}</span>
      <span className="gd-keyfacts__value">{withMark(linkifyPhones(pick(fact.value), { variant: 'inline' }), fact.source && guide.sources[fact.source - 1] ? <SourceMark guide={guide} index={fact.source} /> : null)}</span>
    </li>)}</ol>
  </section>;
}

/**
 * H08 (GR-03): "30 秒看懂" for a guide without an editorial record — up to three of the article's own sentences (guide-quick-facts.ts):
 * the first sourced fact, the first phone number as a tap-to-call chip, the first deadline or fee. Labelled 从本文整理; a row
 * with no translation in the reader's language is left out, and the card is not shown when no row is left.
 */
export function QuickFactsCard({ guide, facts }: { guide: Guide; facts: readonly QuickFact[] }) {
  const { t, locale } = useUiCopy();
  const rows = facts.flatMap(fact => { const text = quickFactIn(fact, guide, locale); return text ? [{ fact, text }] : []; });
  if (!rows.length) return null;
  const label = { fact: t('先知道', 'Key fact'), phone: t('打电话', 'Call'), deadline: t('日期与期限', 'Dates and deadlines'), fee: t('费用', 'Cost') };
  return <section className="gd-keyfacts" data-fallback="" aria-labelledby="gd-keyfacts-title">
    <h2 id="gd-keyfacts-title">{t('30 秒看懂', 'In 30 seconds')}<span className="gd-keyfacts__from">{t('从本文整理', 'From this guide')}</span></h2>
    <ol>{rows.map(({ fact, text }) => <li key={fact.kind}>
      <span className="gd-keyfacts__label">{label[fact.kind]}</span>
      <span className="gd-keyfacts__value">{linkifyPhones(text, { variant: 'inline' })}</span>
    </li>)}</ol>
    <a className="gd-keyfacts__sources" href="#guide-sources">{t('看文末官方来源', 'See the official sources')}</a>
  </section>;
}

const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** One agency: name, the number large and unbroken, languages, [拨打] [复制] and a map link for each address. */
function ContactCard({ guide, contact }: { guide: Guide; contact: GuideContact }) {
  const { t, pick } = useUiCopy();
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const name = pick(contact.name);
  const copy = async () => setCopied(await copyText(contact.number) ? 'done' : 'failed');
  const addresses: readonly string[] = contact.address === undefined ? [] : typeof contact.address === 'string' ? [contact.address] : contact.address;
  return <article className="gd-contact">
    <h3>{name}<SourceMark guide={guide} index={contact.source} /></h3>
    <p className="gd-contact__number">{contact.number}</p>
    {contact.languages && <p className="gd-contact__languages">{contact.languages.map(language => <StatusChip key={language.zh}>{pick(language)}</StatusChip>)}</p>}
    {contact.note && <p className="gd-contact__note">{pick(contact.note)}</p>}
    {addresses.length === 1 && <p className="gd-contact__address" translate="no">{addresses[0]}</p>}
    {/* Several places: each address is its own map link (one search per place, never two addresses in one query). */}
    {addresses.length > 1 && <ul className="gd-contact__places" aria-label={t('地点', 'Locations')}>{addresses.map(address => <li key={address}>
      <a href={mapsUrl(address)} target="_blank" rel="noopener noreferrer" translate="no" aria-label={t(`在地图打开 ${address}`, `Open ${address} in Maps`)}><MapPin aria-hidden="true" strokeWidth={1.75} />{address}</a>
    </li>)}</ul>}
    <div className="gd-contact__actions">
      <Button variant="primary" href={`tel:${contact.tel}`} aria-label={t(`拨打 ${name} ${contact.number}`, `Call ${name} ${contact.number}`)} icon={<Phone aria-hidden="true" strokeWidth={1.75} />}>{t('拨打', 'Call')}</Button>
      <Button onClick={() => void copy()} aria-label={t(`复制号码 ${contact.number}`, `Copy ${contact.number}`)} icon={copied === 'done' ? <Check aria-hidden="true" strokeWidth={1.75} /> : <Copy aria-hidden="true" strokeWidth={1.75} />}>
        {copied === 'done' ? t('已复制', 'Copied') : t('复制', 'Copy')}
      </Button>
      {addresses.length === 1 && <Button href={mapsUrl(addresses[0])} target="_blank" rel="noopener noreferrer" icon={<MapPin aria-hidden="true" strokeWidth={1.75} />}>{t('在地图打开', 'Open in Maps')}</Button>}
    </div>
    <p className="gd-contact__status" role="status">{copied === 'failed' ? t('浏览器未允许复制，请长按号码手动复制。', 'Copy was blocked; press and hold the number to copy it.') : ''}</p>
  </article>;
}

/** 联系卡: every agency the guide tells you to call, in the order the article uses them (GUIDE-09, G14). */
export function ContactCards({ guide, contacts }: { guide: Guide; contacts: readonly GuideContact[] }) {
  const { t } = useUiCopy();
  return <section className="gd-contacts" aria-labelledby="gd-contacts-title">
    <h2 id="gd-contacts-title">{t('联系电话', 'Who to call')}</h2>
    <div className="gd-contacts__list">{contacts.map(contact => <ContactCard key={contact.tel} guide={guide} contact={contact} />)}</div>
  </section>;
}
