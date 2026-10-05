import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, MapPin } from 'lucide-react';
import { CITY_COUNTIES, cityExplorationKey, cityExplorationUrl, type CityExploration } from '../data/city-exploration-types';
import { useLocale, translateText } from '../i18n/locale';
import { cityExplorationMatches } from '../lib/city-exploration';
import { ATTRACTIONS } from '../data/attractions';
import { CityCurrentCard } from './CityCurrentCard';

export function CityExplorationDirectory({ cities, title, text }: { cities: CityExploration[]; title: string; text: string }) {
  const locale = useLocale(), id = useId();
  const t = (value: string) => translateText(value, locale);
  const [params, setParams] = useSearchParams();
  const selectedCity = cities.find(city => cityExplorationKey(city.city) === params.get('city'));
  const query = selectedCity?.city || (params.get('q') || '').slice(0, 150);
  const county = CITY_COUNTIES.find(name => name === params.get('county')) || 'all';
  const results = cities.filter(city => (county === 'all' || county === city.county) && (selectedCity ? city === selectedCity : cityExplorationMatches(city, query, locale)));
  const change = (key: 'q' | 'county', value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    next.delete('city');
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true, preventScrollReset: true });
  const clear = () => setParams(current => {
    const next = new URLSearchParams(current);
    ['city', 'county', 'q'].forEach(key => next.delete(key));
    return next;
  }, { replace: true, preventScrollReset: true });
  return <section className="city-exploration" aria-label={t(title)}>
    <h3>{t(title)}</h3><p>{t(text)}</p>
    <div className="city-exploration-filters">
      <label htmlFor={`${id}-query`}>{t('搜索城市、景点或生活资源')}<input id={`${id}-query`} type="search" value={query} onChange={event => change('q', event.target.value)} placeholder={t('例如：San Jose、半月湾、图书馆')} /></label>
      <label htmlFor={`${id}-county`}>{t('按县筛选')}<select id={`${id}-county`} value={county} onChange={event => change('county', event.target.value)}><option value="all">{t('全部九县')}</option>{CITY_COUNTIES.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      {(query || county !== 'all') && <button type="button" onClick={clear}>{t('清除筛选')}</button>}
    </div>
    <p className="city-exploration-count" role="status">{t('显示城市')}：{results.length} / {cities.length}</p>
    {!results.length && <p>{t('没有匹配的城市，请换关键词或清除县筛选。')}</p>}
    {CITY_COUNTIES.map(name => {
      const rows = results.filter(city => city.county === name);
      if (!rows.length) return null;
      return <section className="city-exploration-county" key={name} aria-label={name}>
        <h3>{name} <span>{rows.length}</span></h3>
        {rows.map(city => <details className="city-exploration-card" key={city.city} id={`city-${cityExplorationKey(city.city)}`} open={results.length === 1 || selectedCity === city ? true : undefined}>
          <summary><span><strong>{city.city}</strong><span>{t(city.summary)}</span><small>{city.places.map(place => t(place.name)).join(' · ')}</small></span><ChevronDown size={19} aria-hidden="true" /></summary>
          <div className="city-exploration-body">
            {city.currentUpdate && <CityCurrentCard update={city.currentUpdate} />}
            <h4>{t('值得去的地方')}</h4>
            <div className="city-exploration-places">{city.places.map(place => <article key={place.name}>
              <span className="city-place-scope">{t(place.scope === 'city' ? '市内去处' : place.scope === 'cross-boundary' ? '跨市界延伸' : '附近延伸 · 不在本市')}</span>
              <h5>{t(place.name)}</h5><p>{t(place.description)}</p>
              {place.verifiedAt && <p className="city-current-date">{t('景点核验')}：<time dateTime={place.verifiedAt}>{place.verifiedAt}</time></p>}
              <div><a href={place.url} target="_blank" rel="noopener noreferrer">{t('官方参观信息')} <ArrowUpRight size={13} aria-hidden="true" /></a>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery)}`} target="_blank" rel="noopener noreferrer"><MapPin size={13} aria-hidden="true" />{t('在地图查找')}</a></div>
            </article>)}</div>
            <dl className="city-exploration-tips">
              <div><dt>{t('来玩：半日怎么安排')}</dt><dd>{t(city.halfDay)}</dd></div>
              <div><dt>{t('刚搬来：从哪里开始')}</dt><dd>{t(city.arrival)}</dd></div>
              <div><dt>{t('住久了：再发现身边资源')}</dt><dd>{t(city.residentTip)}</dd></div>
              <div><dt>{t('交通与停车')}</dt><dd>{t(city.transport)}</dd></div>
              <div><dt>{t('出发前核对')}</dt><dd>{t(city.checks)}</dd></div>
            </dl>
            <h4>{t('当地官方资讯与活动入口')}</h4>
            <div className="city-exploration-links">{city.resources.map(resource => <a key={`${resource.kind}-${resource.url}`} href={resource.url} target="_blank" rel="noopener noreferrer">{t(resource.label)} <ArrowUpRight size={13} aria-hidden="true" /></a>)}</div>
            {ATTRACTIONS.some(place => place.city === city.city) && <div className="city-exploration-reading"><h4>{t('相关景点深度攻略')}</h4><div className="city-exploration-links">{ATTRACTIONS.filter(place => place.city === city.city).map(place => <Link key={place.id} to={`/guides/${place.slug}${locale === 'zh-Hans' ? '' : `?lang=${locale}`}`}>{t(place.title)} →</Link>)}</div></div>}
            <footer><Link to={cityExplorationUrl(city.city, locale)}>{t('这座城市的攻略链接')}</Link><span>{t('核验日期')}：<time dateTime={city.verifiedAt}>{city.verifiedAt}</time></span></footer>
          </div>
        </details>)}
      </section>;
    })}
  </section>;
}
