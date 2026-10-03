import { useId, useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { useLocale, translateText } from '../i18n/locale';
import { SHOPPING_KINDS, SHOPPING_REGIONS, type ShoppingPlace } from '../data/shopping-types';
import { shoppingPlaceMatches } from '../lib/shopping-directory';

export function ShoppingDirectory({ places, title, text }: { places: ShoppingPlace[]; title: string; text: string }) {
  const locale = useLocale();
  const t = (value: string) => translateText(value, locale);
  const id = useId();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [kind, setKind] = useState('all');
  const results = places.filter(place => (region === 'all' || place.region === region) && (kind === 'all' || place.kind === kind) && shoppingPlaceMatches(place, query, locale));
  return <section className="shopping-directory" aria-label={t(title)}>
    <h3>{t(title)}</h3><p>{t(text)}</p>
    <div className="shopping-filters">
      <label htmlFor={`${id}-query`}>{t('搜索购物地点')}<input id={`${id}-query`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('例如：Livermore、Valley Fair、室内')} /></label>
      <label htmlFor={`${id}-region`}>{t('按地区筛选')}<select id={`${id}-region`} value={region} onChange={event => setRegion(event.target.value)}><option value="all">{t('全部地区')}</option>{Object.entries(SHOPPING_REGIONS).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
      <label htmlFor={`${id}-kind`}>{t('按购物类型筛选')}<select id={`${id}-kind`} value={kind} onChange={event => setKind(event.target.value)}><option value="all">{t('全部购物类型')}</option>{Object.entries(SHOPPING_KINDS).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
      {(query || region !== 'all' || kind !== 'all') && <button type="button" onClick={() => {setQuery(''); setRegion('all'); setKind('all');}}>{t('清除筛选')}</button>}
    </div>
    <p className="shopping-result-count" role="status">{t('显示地点')}：{results.length} / {places.length}</p>
    {!results.length && <p>{t('没有匹配的购物地点，请换关键词或清除筛选。')}</p>}
    {Object.entries(SHOPPING_REGIONS).map(([key, label]) => {
      const rows = results.filter(place => place.region === key);
      if (!rows.length) return null;
      return <section className="shopping-region" key={key} aria-label={t(label)}><h3>{t(label)} <span>{rows.length}</span></h3>
        {rows.map(place => <article className="shopping-place" key={place.id} id={`shopping-${place.id}`}>
          <div className="shopping-place-meta"><span>{t(SHOPPING_KINDS[place.kind])}</span><span>{place.city}</span></div>
          <h4>{place.name}</h4><p>{t(place.description)}</p><p className="shopping-best"><strong>{t('适合谁')}：</strong>{t(place.bestFor)}</p>
          <details><summary>{t('地址、交通与逛街攻略')}</summary><dl>
            <dt>{t('地址／街区范围')}</dt><dd>{place.address}</dd>
            <dt>{t('建议怎么逛')}</dt><dd>{t(place.plan)}</dd>
            <dt>{t('交通与停车')}</dt><dd>{t(place.transport)}</dd>
            <dt>{t('出发前提醒')}</dt><dd>{t(place.caution)}</dd>
          </dl><div className="shopping-place-links">
            <a href={place.url} target="_blank" rel="noopener noreferrer">{t('官方网站')} <ArrowUpRight size={13} aria-hidden="true" /></a>
            <a href={place.directoryUrl} target="_blank" rel="noopener noreferrer">{t('店铺目录／品牌查询')} <ArrowUpRight size={13} aria-hidden="true" /></a>
            <a href={place.visitUrl} target="_blank" rel="noopener noreferrer">{t('到访与停车信息')} <ArrowUpRight size={13} aria-hidden="true" /></a>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address}`)}`} target="_blank" rel="noopener noreferrer"><MapPin size={13} aria-hidden="true" />{t('在地图查找')}</a>
          </div><small>{t('核验日期')}：{place.verifiedAt}</small></details>
        </article>)}
      </section>;
    })}
  </section>;
}
