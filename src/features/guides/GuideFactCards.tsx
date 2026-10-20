import { useState, type ReactNode } from 'react';
import { Check, Copy, MapPin, Phone } from 'lucide-react';
import { StatusChip } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { Guide } from '../../data/guides';
import type { GuideContact, GuideKeyFact } from '../../data/guide-editorial';
import { linkifyGuidePhones, usePlainPhones } from './plain-phones';
import { copyText } from '../../utils/postShare';

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
  const except = usePlainPhones();
  return <section className="gd-keyfacts" aria-labelledby="gd-keyfacts-title">
    <h2 id="gd-keyfacts-title">{t('30 秒看懂', 'In 30 seconds')}</h2>
    <ol>{facts.map(fact => <li key={fact.label.zh}>
      <span className="gd-keyfacts__label">{pick(fact.label)}</span>
      <span className="gd-keyfacts__value">{withMark(linkifyGuidePhones(pick(fact.value), { variant: 'inline', except }), fact.source && guide.sources[fact.source - 1] ? <SourceMark guide={guide} index={fact.source} /> : null)}</span>
    </li>)}</ol>
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
    <p className="gd-contact__number" data-simple="hide">{contact.number}</p>
    {contact.languages && <p className="gd-contact__languages">{contact.languages.map(language => <StatusChip key={language.zh}>{pick(language)}</StatusChip>)}</p>}
    {contact.note && <p className="gd-contact__note">{pick(contact.note)}</p>}
    {addresses.length === 1 && <p className="gd-contact__address" translate="no">{addresses[0]}</p>}
    {/* Several places: each address is its own map link (one search per place, never two addresses in one query). */}
    {addresses.length > 1 && <ul className="gd-contact__places" aria-label={t('地点', 'Locations')}>{addresses.map(address => <li key={address}>
      <a href={mapsUrl(address)} target="_blank" rel="noopener noreferrer" translate="no" aria-label={t(`在地图打开 ${address}`, `Open ${address} in Maps`)}><MapPin aria-hidden="true" strokeWidth={1.75} />{address}</a>
    </li>)}</ul>}
    {/* One filled button per section (the bar's 拨打): here 拨打 is secondary with the brand phone glyph, 复制 and the map quiet.
        In 简洁显示 拨打 prints the number (48 px; the head's number line hides), so each number has at most two tap targets. */}
    <div className="gd-contact__actions">
      <Button variant="secondary" className="gd-contact__call" href={`tel:${contact.tel}`} aria-label={t(`拨打 ${name} ${contact.number}`, `Call ${name} ${contact.number}`)} icon={<Phone aria-hidden="true" strokeWidth={1.75} />}>{t('拨打', 'Call')}<span className="gd-contact__call-number"> {contact.number}</span></Button>
      <Button variant="quiet" onClick={() => void copy()} aria-label={t(`复制号码 ${contact.number}`, `Copy ${contact.number}`)} icon={copied === 'done' ? <Check aria-hidden="true" strokeWidth={1.75} /> : <Copy aria-hidden="true" strokeWidth={1.75} />}>
        {copied === 'done' ? t('已复制', 'Copied') : t('复制', 'Copy')}
      </Button>
      {addresses.length === 1 && <Button variant="quiet" href={mapsUrl(addresses[0])} target="_blank" rel="noopener noreferrer" icon={<MapPin aria-hidden="true" strokeWidth={1.75} />}>{t('在地图打开', 'Open in Maps')}</Button>}
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
