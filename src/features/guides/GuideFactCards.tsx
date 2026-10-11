import { useState } from 'react';
import { Check, Copy, MapPin, Phone } from 'lucide-react';
import { StatusChip } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { Guide } from '../../data/guides';
import type { GuideContact, GuideKeyFact } from '../../data/guide-editorial';
import { linkifyPhones } from '../../lib/phone-links';
import { copyText } from '../../utils/postShare';

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬'];

/** A superscript ① that jumps to the article's source list (its anchor `guide-source-n`). */
function SourceMark({ guide, index }: { guide: Guide; index?: number }) {
  const { t } = useUiCopy();
  if (!index || !guide.sources[index - 1]) return null;
  return <a className="gd-source-mark" href={`#guide-source-${index}`} aria-label={t(`来源 ${index}`, `Source ${index}`)}>{CIRCLED[index - 1] ?? `[${index}]`}</a>;
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
      <span className="gd-keyfacts__value">{linkifyPhones(pick(fact.value), { variant: 'inline' })}<SourceMark guide={guide} index={fact.source} /></span>
    </li>)}</ol>
  </section>;
}

/** One agency: name, the number large and unbroken, languages, [拨打] [复制] and a map link when there is an address. */
function ContactCard({ guide, contact }: { guide: Guide; contact: GuideContact }) {
  const { t, pick } = useUiCopy();
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const name = pick(contact.name);
  const copy = async () => setCopied(await copyText(contact.number) ? 'done' : 'failed');
  return <article className="gd-contact">
    <h3>{name}<SourceMark guide={guide} index={contact.source} /></h3>
    <p className="gd-contact__number">{contact.number}</p>
    {contact.languages && <p className="gd-contact__languages">{contact.languages.map(language => <StatusChip key={language.zh} tone="info">{pick(language)}</StatusChip>)}</p>}
    {contact.note && <p className="gd-contact__note">{pick(contact.note)}</p>}
    {contact.address && <p className="gd-contact__address" translate="no">{contact.address}</p>}
    <div className="gd-contact__actions">
      <Button variant="primary" href={`tel:${contact.tel}`} aria-label={t(`拨打 ${name} ${contact.number}`, `Call ${name} ${contact.number}`)} icon={<Phone aria-hidden="true" strokeWidth={1.75} />}>{t('拨打', 'Call')}</Button>
      <Button onClick={() => void copy()} aria-label={t(`复制号码 ${contact.number}`, `Copy ${contact.number}`)} icon={copied === 'done' ? <Check aria-hidden="true" strokeWidth={1.75} /> : <Copy aria-hidden="true" strokeWidth={1.75} />}>
        {copied === 'done' ? t('已复制', 'Copied') : t('复制', 'Copy')}
      </Button>
      {contact.address && <Button href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`} target="_blank" rel="noopener noreferrer" icon={<MapPin aria-hidden="true" strokeWidth={1.75} />}>{t('在地图打开', 'Open in Maps')}</Button>}
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
