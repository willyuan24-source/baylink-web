import { useId, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { PLATFORM_CATEGORIES, PLATFORM_FORMATS, type UsefulPlatform } from '../data/useful-platform-types';
import { usefulPlatformMatches } from '../lib/useful-platforms';
import { useLocale, translateText } from '../i18n/locale';

export function UsefulPlatformsDirectory({ platforms, title, text }: { platforms: UsefulPlatform[]; title: string; text: string }) {
  const locale = useLocale(), id = useId();
  const t = (value: string) => translateText(value, locale);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const results = platforms.filter(platform => (category === 'all' || platform.category === category) && usefulPlatformMatches(platform, query, locale));
  return <section className="useful-platforms" aria-label={t(title)}>
    <h3>{t(title)}</h3><p>{t(text)}</p>
    <div className="platform-filters">
      <label htmlFor={`${id}-query`}>{t('搜索 App、平台或用途')}<input id={`${id}-query`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('例如：Uber、熊猫外卖、租房、返现')} /></label>
      <label htmlFor={`${id}-category`}>{t('按生活用途筛选')}<select id={`${id}-category`} value={category} onChange={event => setCategory(event.target.value)}><option value="all">{t('全部用途')}</option>{Object.entries(PLATFORM_CATEGORIES).map(([key, label]) => <option value={key} key={key}>{t(label)}</option>)}</select></label>
      {(query || category !== 'all') && <button type="button" onClick={() => { setQuery(''); setCategory('all'); }}>{t('清除筛选')}</button>}
    </div>
    <p className="platform-result-count" role="status">{t('显示平台')}：{results.length} / {platforms.length}</p>
    {!results.length && <p>{t('没有匹配的平台，请换关键词或清除筛选。')}</p>}
    {Object.entries(PLATFORM_CATEGORIES).map(([key, label]) => {
      const rows = results.filter(platform => platform.category === key);
      if (!rows.length) return null;
      return <section className="platform-category" key={key} aria-label={t(label)}>
        <h3>{t(label)} <span>{rows.length}</span></h3>
        {rows.map(platform => <article className="platform-card" id={`platform-${platform.id}`} key={platform.id}>
          <span className="platform-format">{t(PLATFORM_FORMATS[platform.format])}</span>
          <h4>{t(platform.name)}</h4><p>{t(platform.summary)}</p>
          <p><strong>{t('适合谁')}：</strong>{t(platform.bestFor)}</p>
          <a className="platform-primary" href={platform.url} target="_blank" rel="noopener noreferrer">{t('官方入口与下载')} <ArrowUpRight size={14} aria-hidden="true" /></a>
          <details open={results.length === 1 ? true : undefined}><summary>{t('怎么用、服务范围与费用提醒')}</summary>
            <dl><dt>{t('建议怎么开始')}</dt><dd>{t(platform.howTo)}</dd><dt>{t('湾区适用范围')}</dt><dd>{t(platform.coverage)}</dd><dt>{t('使用前看清楚')}</dt><dd>{t(platform.watchFor)}</dd></dl>
            <div className="platform-sources">{platform.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" title={t(source.description)}>{t(source.title)} <ArrowUpRight size={12} aria-hidden="true" /></a>)}</div>
            <small>{t('核验日期')}：<time dateTime={platform.verifiedAt}>{platform.verifiedAt}</time></small>
          </details>
        </article>)}
      </section>;
    })}
  </section>;
}
