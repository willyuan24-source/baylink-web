import { useId, useState } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { translateText, useLocale } from '../i18n/locale';
import { BROADBAND_MAP_URL, type UtilityCity, type UtilityContact } from '../data/utility-types';
import { utilityCityMatches } from '../lib/utility-directory';
import { linkifyPhones } from '../lib/phone-links';

function Contact({ contact }: { contact: UtilityContact }) {
  const locale = useLocale();
  const t = (value: string) => translateText(value, locale);
  // A phone field may hold an extension or a second number; each US number in it becomes a tap-to-call chip.
  return <div className="utility-contact">
    <a href={contact.url} target="_blank" rel="noopener noreferrer">{t(contact.name)} <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only">{t('（在新标签页打开）')}</span></a>
    {contact.phone && <span className="utility-phone">{linkifyPhones(contact.phone, { name: t(contact.name), variant: 'row' })}</span>}
    {contact.email && <a className="utility-email" href={`mailto:${contact.email}`}>{contact.email}</a>}
    {contact.note && <p>{t(contact.note)}</p>}
    {(contact.availabilityUrl || contact.movingUrl) && <div className="utility-contact-actions">
      {contact.availabilityUrl && <a href={contact.availabilityUrl} target="_blank" rel="noopener noreferrer">{t('查地址可用服务')} ↗</a>}
      {contact.movingUrl && <a href={contact.movingUrl} target="_blank" rel="noopener noreferrer">{t('搬家／转移服务')} ↗</a>}
    </div>}
  </div>;
}

export function UtilityContactDirectory({ contacts, title, text, anchor }: {
  contacts: UtilityContact[]; title: string; text: string; anchor: string;
}) {
  const locale = useLocale();
  const t = (value: string) => translateText(value, locale);
  return <section className="utility-carriers" id={anchor} aria-label={t(title)}>
    <h3>{t(title)}</h3><p>{t(text)}</p>
    <div className="utility-carrier-grid">{contacts.map(contact => <Contact key={contact.name} contact={contact} />)}</div>
  </section>;
}

export function UtilityDirectory({ cities, title, text }: { cities: UtilityCity[]; title: string; text: string }) {
  const locale = useLocale();
  const t = (value: string) => translateText(value, locale);
  const id = useId();
  const [query, setQuery] = useState('');
  const [county, setCounty] = useState('all');
  const counties = [...new Set(cities.map(city => city.county))];
  const matches = cities.filter(city => (county === 'all' || city.county === county) && utilityCityMatches(city, query));
  return <section className="utility-directory" aria-label={t(title)}>
    <h3>{t(title)}</h3><p>{t(text)}</p>
    <div className="utility-filters">
      <label htmlFor={`${id}-search`}>{t('搜索城市或服务商')}<input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('例如：San Jose、旧金山、EBMUD')} /></label>
      <label htmlFor={`${id}-county`}>{t('按县筛选')}<select id={`${id}-county`} value={county} onChange={event => setCounty(event.target.value)}>
        <option value="all">{t('全部九县')}</option>{counties.map(name => <option key={name} value={name}>{name}</option>)}
      </select></label>
      {(query || county !== 'all') && <button type="button" onClick={() => { setQuery(''); setCounty('all'); }}>{t('清除筛选')}</button>}
    </div>
    <p className="utility-result-count" role="status">{t('显示城市')}：{matches.length} / {cities.length}</p>
    {!matches.length && <p className="utility-empty">{t('没有找到匹配项。可试英文城市名、清除县筛选，或查看下方非建制地区说明。')}</p>}
    {counties.map(name => {
      const rows = matches.filter(city => city.county === name);
      if (!rows.length) return null;
      return <section className="utility-county" key={name} aria-label={name}>
        <h3>{name} <span>{rows.length}</span></h3>
        {rows.map(city => <details className="utility-city" key={`${name}-${city.city}`}>
          <summary><span><strong>{city.city}</strong><small>{[...city.water, ...city.electric, ...city.waste].map(contact => t(contact.name)).join(' · ')}</small></span><ChevronDown size={20} aria-hidden="true" /></summary>
          <div className="utility-city-body">
            {city.notes && <p className="utility-city-note">{t(city.notes)}</p>}
            <dl className="utility-services">{([
              ['供水／水费', city.water], ['电力／开户', city.electric], ['垃圾／回收', city.waste],
            ] as const).map(([label, contacts]) => <div key={label}><dt>{t(label)}</dt><dd>{contacts.map(contact => <Contact key={`${contact.name}-${contact.url}`} contact={contact} />)}</dd></div>)}
              <div><dt>Internet</dt><dd><p>{t('宽带按完整住址及房号确认；城市名不能保证可装。')}</p><a href={BROADBAND_MAP_URL} target="_blank" rel="noopener noreferrer">{t('加州官方宽带地址查询')} ↗</a><a href="#utility-internet-contacts">{t('宽带公司电话与搬家入口')} ↓</a></dd></div>
            </dl>
            <footer><a href={city.municipalUrl} target="_blank" rel="noopener noreferrer">{t('当地官方服务资料')} ↗</a><span>{t('核验日期')}：<time dateTime={city.verifiedAt}>{city.verifiedAt}</time></span></footer>
          </div>
        </details>)}
      </section>;
    })}
  </section>;
}
